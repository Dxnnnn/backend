const express = require("express");
const router = express.Router();
const { createSchoolHead, getAllSchoolHeads, deleteSchoolHead, loginSchoolHead, toggleSchoolHeadStatus, updateSchoolHead, resetSchoolHeadPassword } = require("../controller/schoolHeadController");
const { verifyToken, requireRole } = require("../middleware/verifyToken");

// Public — login
router.post("/login", loginSchoolHead);

// Protected — admin only (manage school head accounts)
router.get("/", verifyToken, requireRole("admin"), getAllSchoolHeads);
router.post("/", verifyToken, requireRole("admin"), createSchoolHead);
router.put("/:id", verifyToken, requireRole("admin"), updateSchoolHead);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), toggleSchoolHeadStatus);
router.patch("/:id/reset-password", verifyToken, requireRole("admin"), resetSchoolHeadPassword);
router.delete("/:id", verifyToken, requireRole("admin"), deleteSchoolHead);

module.exports = router;
