// cloudinary.js
const cloudinary = require("cloudinary").v2; // Keep .v2, it's safer
const cloudinaryStorage = require("multer-storage-cloudinary"); // In v2.2.1, this is a function
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Setup storage using the v2.2.1 function syntax
const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: "uploads",
  allowedFormats: ["jpg", "png", "jpeg", "mp4"],
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Multer middleware
const upload = multer({ storage });

module.exports = { cloudinary, storage, upload };