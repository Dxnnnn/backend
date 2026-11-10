const express = require("express");
const router = express.Router();
const { createSchoolHead, getAllSchoolHeads, deleteSchoolHead, loginSchoolHead, toggleSchoolHeadStatus, updateSchoolHead, resetSchoolHeadPassword, changeSchoolHeadPassword, getMySchoolHeadProfile } = require("../controller/schoolHeadController");
const { verifyToken, requireRole, requirePermission } = require("../middleware/verifyToken");

// Public — login
router.post("/login", loginSchoolHead);

// School head self — profile + change password (uses school head JWT)
router.get("/me", verifyToken, getMySchoolHeadProfile);
router.put("/me/password", verifyToken, changeSchoolHeadPassword);

// Protected — admin with "accounts.school_head" permission
router.get("/", verifyToken, requireRole("admin"), requirePermission("accounts.school_head"), getAllSchoolHeads);
router.post("/", verifyToken, requireRole("admin"), requirePermission("accounts.school_head"), createSchoolHead);
router.put("/:id", verifyToken, requireRole("admin"), requirePermission("accounts.school_head"), updateSchoolHead);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), requirePermission("accounts.school_head"), toggleSchoolHeadStatus);
router.patch("/:id/reset-password", verifyToken, requireRole("admin"), requirePermission("accounts.school_head"), resetSchoolHeadPassword);
router.delete("/:id", verifyToken, requireRole("admin"), requirePermission("accounts.school_head"), deleteSchoolHead);

module.exports = router;
