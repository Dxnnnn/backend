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
} = require("../controller/studentController");
const { verifyToken, requireRole } = require("../middleware/verifyToken");

// Public — login
router.post("/login", loginStudent);

// Protected — admin only (manage student accounts)
router.get("/", verifyToken, requireRole("admin"), getAllStudents);
router.post("/", verifyToken, requireRole("admin"), createStudent);
router.put("/:id", verifyToken, requireRole("admin"), updateStudent);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), toggleStudentStatus);
router.patch("/:id/reset-password", verifyToken, requireRole("admin"), resetStudentPassword);
router.delete("/:id", verifyToken, requireRole("admin"), deleteStudent);

// Get students assigned to a specific faculty
router.get("/by-faculty/:facultyId", verifyToken, getStudentsByFaculty);

module.exports = router;
