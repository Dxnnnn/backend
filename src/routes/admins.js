const express = require("express");
const router = express.Router();
const { getAllAdmins, createAdmin, toggleAdminStatus, deleteAdmin, changePassword, resetAdminPassword } = require("../controller/adminController");
const { getPermissions, setPermissions } = require("../controller/permissionController");
const { verifyToken, requireRole } = require("../middleware/verifyToken");

// ── Admin account management (any admin role can manage accounts) ─────────────
router.get("/", verifyToken, requireRole("admin"), getAllAdmins);
router.post("/", verifyToken, requireRole("admin"), createAdmin);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), toggleAdminStatus);
router.delete("/:id", verifyToken, requireRole("admin"), deleteAdmin);
router.post("/:id/reset-password", verifyToken, requireRole("admin"), resetAdminPassword);
router.put("/me/password", verifyToken, requireRole("admin"), changePassword);

// ── Granular permissions (Super Admin only) ───────────────────────────────────
router.get("/:id/permissions", verifyToken, requireRole("admin"), getPermissions);
router.put("/:id/permissions", verifyToken, requireRole("admin"), setPermissions);

module.exports = router;
