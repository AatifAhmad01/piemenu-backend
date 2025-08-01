import asyncHandler from '../Utils/asyncHandler.js';
import ApiError from '../Utils/ApiError.js';
import ApiResponse from '../Utils/ApiResponse.js';
import { User } from '../Models/User.js';
import { Store } from '../Models/Store.js';
import jwt from 'jsonwebtoken';

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        console.log(error);
        throw new ApiError(500, "Something Went Wronge");
    }
}

const registerUser = asyncHandler(async (req, res) => {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        throw new ApiError(400, "All fields are required.");
    }

    try {
        const user = await User.findOne({ email });
        if (user) {
            throw new ApiError(409, "User already exists with this email.");
        }

        // add tokens
        const newUser = await User.create({
            name,
            email,
            password
        });

        console.log(newUser.id);

        const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(newUser.id);

        await newUser.save({ validateBeforeSave: false });

        if (!newUser) throw new ApiError(500, "Somthing Went Wronge.");

        res.status(200).json(new ApiResponse(200, "User Registered Successfully", {
            name,
            email,
            accessToken,
            refreshToken
        }))

    } catch (error) {
        console.log(error);
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.");
    }
})

const refreshAccessToken = asyncHandler(async (req, res) => {

    const storeId = req.params.storeId;
    const refreshToken = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!refreshToken) throw new ApiError(401, "Unauthorized Request");

    const decodedToken = jwt.decode(refreshToken, process.env.JWT_REFRESH_SECRET);

    try {

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!user) throw new ApiError(401, "Unauthorized Request");

        const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user.id);

        const stores = await Store.find({owner: user.id}).select("-owner");

        user.password = undefined;

        const cookieOptions = {
            httpOnly: true,  // Ensures cookies are only accessible by the server
            secure: true,    // Ensures cookies are sent over HTTPS
            sameSite: "none" // Allows cookies to be sent from different origins (important for frontend-backend communication)
        };

        res.status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(new ApiResponse(200, "User Registered Successfully", {
                user,
                stores
            }))
    }
    catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.");
    }
})


const loginUser = asyncHandler(async (req, res) => {


    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "All fields are required.");
    }

    try {
        const user = await User.findOne({ email });

        if (!user) throw new ApiError(404, "No User is registered with the eamil")

        const isPasswordCorrect = await user.isPasswordCorrect(password);

        if (!isPasswordCorrect) throw new ApiError(400, "Incorrect credentials");

        const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user.id);

        user.password = undefined;

        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        };

        res.status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(new ApiResponse(200, "User Logged in Successfully", user))
    }
    catch (error) {
        console.log(error);
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.");
    }
})

const changePassword = asyncHandler(async (req, res) => {

    const user = req.user;
    const { oldPassword, newPassword } = req.body;

    try {

        const dbUser = await User.findById(user?.id);

        if (!dbUser) throw new ApiError(403, "No user found");

        const isPasswordTrue = await dbUser.isPasswordCorrect(oldPassword)

        if (!isPasswordTrue) throw new ApiError(400, "Incorrect credentials");

        dbUser.password = newPassword;

        await dbUser.save({ validateBeforeSave: false });

        res.status(200).json(new ApiResponse(200, "User password changed Successfully", {}))

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.");
    }
})

const updateUser = asyncHandler(async (req, res) => {

    const user = req.user;
    const fieldsToUpdate = req.body;

    if (!Object.keys(fieldsToUpdate).length) throw new ApiError(403, "Nothing to update");

    try {
        const updatedUser = await User.findByIdAndUpdate(user._id, {
            $set: { ...fieldsToUpdate }
        }, { new: true }).select("-password -refreshToken");

        if (!updatedUser) throw new ApiError(403, "No user found");

        res.status(200).json(new ApiResponse(200, "User details updated Successfully", updatedUser))

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.");
    }
})

const logoutUser = asyncHandler(async (req, res) => {

    const user = req.user;

    if (!user) throw new ApiError(403, "Unauthorized Request");

    try {
        const userInDb = await User.findById(user.id).select("-password");

        if (!userInDb) throw new ApiError(404, "No user found");

        userInDb.refreshToken = "";

        const logedOutUser = await userInDb.save({ validateBeforeSave: false });

        if (!logedOutUser) throw new ApiError(500, "Somthing went wrong!");

        res.status(200)
            .clearCookie("accessToken")
            .clearCookie("refreshToken")
            .json(new ApiResponse(200, "User Logged Out Successfully", {}))

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.");
    }
})

// Forgot password

export { registerUser, changePassword, updateUser, loginUser, logoutUser, refreshAccessToken }