const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Automatically uses CLOUDINARY_URL from .env
cloudinary.config();

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'uploads', // Cloudinary folder name
    allowed_formats: ['jpg', 'png', 'mp4'],
    public_id: (req, file) => Date.now() + '-' + file.originalname,
  },
});

module.exports = { cloudinary, storage };
