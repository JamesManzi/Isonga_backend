const cloudinary = require('cloudinary').v2;
const CloudinaryStorage = require('multer-storage-cloudinary'); // ⚠️ no destructuring
const multer = require('multer');

// Reads CLOUDINARY_URL from .env automatically
cloudinary.config();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  folder: 'uploads', // ✅ use folder directly
  allowedFormats: ['jpg', 'png', 'mp4'], // ✅ camelCase
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, storage, upload };
