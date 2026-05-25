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

    return {
      folder: "uploads",

      // Automatically detect image or video
      resource_type: isVideo ? "video" : "image",

      // Optional optimization
      transformation: isVideo
        ? undefined
        : [{ quality: "auto" }],

      // Optional automatic format optimization
      fetch_format: "auto",
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowed =
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/");

  if (allowed) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image and video files are allowed."),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

module.exports = { cloudinary, storage, upload };