const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video");
    
    // Check if the uploaded image uses an alternative mobile container format (HEIC/HEIF)
    const isMobileFormat = file.originalname.toLowerCase().match(/\.(heic|heif)$/);

    return {
      folder: "uploads",
      resource_type: isVideo ? "video" : "image",
      
      // Fix 1: Explicitly authorize 'heic' and 'heif' so Cloudinary doesn't reject mobile streams
      allowed_formats: isVideo
        ? ["mp4", "webm", "ogg"]
        : ["jpg", "png", "jpeg", "gif", "heic", "heif"],

      // Fix 2: Tell Cloudinary to convert incoming HEIC images into web-safe JPGs automatically
      format: isVideo ? undefined : (isMobileFormat ? "jpg" : undefined),
      transformation: isVideo ? undefined : [{ quality: "auto" }]
    };
  },
});

const fileFilter = (req, file, cb) => {
  const isImageOrVideo = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
  const isMobileFile = file.originalname.toLowerCase().match(/\.(heic|heif)$/);

  // Fix 3: Allow mobile streams that pass undefined mimetypes but have valid image extensions
  if (isImageOrVideo || isMobileFile) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed. Only videos, images, and mobile photos (HEIC) are accepted."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB capacity for uncompressed high-res mobile snaps
  }
});

module.exports = { cloudinary, storage, upload };