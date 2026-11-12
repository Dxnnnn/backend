const express = require("express");
const router = express.Router();
const { getSemesters, getActiveSemesters, getAllSemestersPublic, createSemester, toggleSemester, deleteSemester } = require("../controller/semesterController");
const { verifyToken, requireRole, requireAdminSubRole, requirePermission } = require("../middleware/verifyToken");

// Public
router.get("/active", getActiveSemesters);
router.get("/all-public", getAllSemestersPublic);

// Protected — EO or DC with "semester" permission
router.get("/", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("semester"), getSemesters);
router.post("/", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("semester"), createSemester);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("semester"), toggleSemester);
router.delete("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("semester"), deleteSemester);

module.exports = router;
