const express = require("express");
const multer = require("multer");
const { uploadImage } = require("../controller/uploadController");

const router = express.Router();

// Keep file in memory so we can forward the buffer to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

// POST /api/upload/image
router.post("/image", (req, res, next) => {
  console.log("[Upload] incoming request, content-type:", req.headers["content-type"]);
  next();
}, upload.single("file"), uploadImage);

module.exports = router;
