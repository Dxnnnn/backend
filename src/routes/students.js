const express = require("express");
const router = express.Router();
const { 
  createStudent, 
  getAllStudents, 
  deleteStudent, 
  loginStudent, 
  toggleStudentStatus, 
  updateStudent,
  getStudentsByFaculty,
  resetStudentPassword,
  getMyProfile,
} = require("../controller/studentController");
const { verifyToken, requireRole, requirePermission } = require("../middleware/verifyToken");

// Public — login
router.post("/login", loginStudent);

// Student self — fetch own fresh profile (uses student JWT)
router.get("/me", verifyToken, getMyProfile);

// Protected — admin with "accounts.student" permission
router.get("/", verifyToken, requireRole("admin"), requirePermission("accounts.student"), getAllStudents);
router.post("/", verifyToken, requireRole("admin"), requirePermission("accounts.student"), createStudent);
router.put("/:id", verifyToken, requireRole("admin"), requirePermission("accounts.student"), updateStudent);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), requirePermission("accounts.student"), toggleStudentStatus);
router.patch("/:id/reset-password", verifyToken, requireRole("admin"), requirePermission("accounts.student"), resetStudentPassword);
router.delete("/:id", verifyToken, requireRole("admin"), requirePermission("accounts.student"), deleteStudent);

// Get students assigned to a specific faculty (any admin, no submodule restriction)
router.get("/by-faculty/:facultyId", verifyToken, getStudentsByFaculty);

module.exports = router;
