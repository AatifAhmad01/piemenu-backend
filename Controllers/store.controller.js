import ApiError from "../Utils/ApiError.js";
import asyncHandler from "../Utils/asyncHandler.js";
import { Store } from "../Models/Store.js";
import ApiResponse from "../Utils/ApiResponse.js";
import { deleteImgFromCloudinary, uploadImageToCloudinary } from "../Utils/Cloudinary.js";



const createStore = asyncHandler(async (req, res) => {
    const user = req.user;
    const { name, converImage, address, contact } = req.body;

    if (!name || !address || !contact) throw new ApiError(400, "All fields required");

    const storeId = Date.now();

    try {

        const newStore = await Store.create({
            storeId,
            name,
            converImage,
            address,
            contact,
            owner: user._id
        })

        if (!newStore) throw new ApiError(500, "Something went wronge");

        res.status(201).json(new ApiResponse(201, "Store Created Successfully", newStore));

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.")
    }
})

const updateStore = asyncHandler(async (req, res) => {

    const store = req.store;
    const fieldsToUpdate = req.body;
    const coverImage = req.file;

    console.log(fieldsToUpdate, "fieldsToUpdate")
    console.log(coverImage, "Cover Image")

    if (!Object.keys(fieldsToUpdate).length && !coverImage) throw new ApiError(400, "Nothing to update");

    try {

        if (coverImage) {
            // Uploading file to cloudinary
            try {
                // delete old cover image from cloudinary
                if (store.coverImage) {
                    await deleteImgFromCloudinary(store.coverImage);
                    console.log("Old cover image deleted from cloudinary");
                }

                const result = await uploadImageToCloudinary(coverImage);
                console.log("Cover image uploaded to cloudinary");
                fieldsToUpdate.coverImage = result.secure_url;
            } catch (err) {
                throw new ApiError(500, "Failed to upload image to Cloudinary");
            }
        }

        const updatedStore = await Store.findByIdAndUpdate(store.id, {
            $set: { ...fieldsToUpdate }
        }, { new: true })

        if (!updatedStore) throw new ApiError(500, "Something went wronge");

        return res.status(200).json(new ApiResponse(200, "Store Updated Successfully", updatedStore));

    } catch (error) {
        throw new ApiError(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge."))
    }
})

const getUserStores = asyncHandler(async (req, res) => {

    const user = req.user;

    if (!user) return new ApiError(403, "Unauthorized Request");

    try {

        const stores = await Store.find({ owner: user.id })

        // If no store
        // if(!stores.length) return new ApiError(404, "No stores found");

        res.status(200).json(new ApiResponse(200, "Store fetched successfully", stores))

    } catch (error) {
        throw new ApiError(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge."))
    }
})

const getStoreById = asyncHandler(async (req, res) => {

    const store = req.store;

    try {

        if (!store) throw new ApiError(201, "Error fetching store");

        res.status(200).json(new ApiResponse(200, "Store fetched successfully", {
            store
        }))

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.")
    }
})

const viewStore = asyncHandler(async (req, res) => {
    let { storeId } = req.params;
    storeId = parseInt(req.params.storeId);

    try {
        const storeWithItems = await Store.aggregate([
            { $match: { storeId, isActive: true } }, // Match using custom storeId (a Number type)
            {
                $project: {
                    __v: 0,
                    isActive: 0,
                    owner: 0
                }
            },
            {
                $lookup: {
                    from: "items", // This matches your model name "Item" -> "items" collection
                    let: { storeObjectId: "$_id" }, // Store the _id for use in the pipeline
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$store", "$$storeObjectId"] }, // Match items where store field equals the store's _id
                                isAvailable: true
                            }
                        },
                        {
                            $project: {
                                name: 1,
                                description: 1,
                                imageUrl: 1,
                                price: 1
                            }
                        }
                    ],
                    as: "foodItems"
                }
            },
            { $limit: 1 }
        ]);

        if (!storeWithItems.length) throw new ApiError(404, "No store found");

        res.status(200).json(new ApiResponse(200, "Store fetched successfully", { store: storeWithItems[0] }));
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Somthing Went Wronge.")
    }
});

const closeStore = asyncHandler(async (req, res) => {
    const store = req.store;

    try {
        if (!store) throw new ApiError(404, "Store not found");

        // Check if store is already closed
        if (!store.isActive) throw new ApiError(400, "Store is already closed");

        const closedStore = await Store.findByIdAndUpdate(store.id, {
            $set: { isActive: false }
        }, { new: true });

        if (!closedStore) throw new ApiError(500, "Something went wrong");

        res.status(200).json(new ApiResponse(200, "Store closed successfully", closedStore));

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Something went wrong");
    }
});

const reopenStore = asyncHandler(async (req, res) => {
    const store = req.store;

    try {
        if (!store) throw new ApiError(404, "Store not found");

        if (store.isActive) throw new ApiError(400, "Store is already active");

        const reopenedStore = await Store.findByIdAndUpdate(store.id, {
            $set: { isActive: true }
        }, { new: true });

        if (!reopenedStore) throw new ApiError(500, "Something went wrong");

        res.status(200).json(new ApiResponse(200, "Store reopened successfully", reopenedStore));

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Something went wrong");
    }
})



export {
    createStore,
    updateStore,
    getUserStores,
    getStoreById,
    viewStore,
    closeStore,
    reopenStore,
}