const express = require("express");
const router = express.Router();
const { getAllAdmins, createAdmin, toggleAdminStatus, deleteAdmin, changePassword } = require("../controller/adminController");
const { verifyToken, requireRole } = require("../middleware/verifyToken");

router.get("/", verifyToken, requireRole("admin"), getAllAdmins);
router.post("/", verifyToken, requireRole("admin"), createAdmin);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), toggleAdminStatus);
router.delete("/:id", verifyToken, requireRole("admin"), deleteAdmin);
router.put("/me/password", verifyToken, requireRole("admin"), changePassword);

module.exports = router;
