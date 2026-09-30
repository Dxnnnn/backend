const cloudinary = require("../config/cloudinary");

/**
 * POST /api/upload/image
 * Accepts a multipart file upload and uploads it to Cloudinary using a
 * signed upload (api_key + api_secret from env).
 * NOTE: Do NOT pass upload_preset on signed uploads — Cloudinary rejects it.
 */
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided." });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "faculty_profiles",
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            console.error("[Cloudinary] upload_stream error:", error);
            return reject(error);
          }
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.status(200).json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error("[Upload] error:", err.message);
    return res.status(500).json({ success: false, message: "Upload error.", error: err.message });
  }
};

module.exports = { uploadImage };
