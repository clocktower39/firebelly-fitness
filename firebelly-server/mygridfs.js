const multer = require('multer');
const mongoose = require('mongoose');

// Use memory storage to temporarily store the file in memory before uploading to GridFS
const storage = multer.memoryStorage();

const uploadProfilePicture = multer({
    storage,
    limits: { fileSize: 1000000 } // 1MB limit
});

const uploadGroupPicture = multer({
    storage,
    limits: { fileSize: 1000000 } // 1MB limit
});

const uploadMessageAttachment = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB (photos / short videos)
});

module.exports = {
    uploadProfilePicture,
    uploadGroupPicture,
    uploadMessageAttachment
};
