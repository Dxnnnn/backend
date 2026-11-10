const express = require("express");
const router = express.Router();
const { 
  createFaculty, 
  getAllFaculty, 
  getFacultyByDepartment, 
  deleteFaculty, 
  toggleFacultyStatus, 
  updateFaculty,
  getFacultyForStudent
} = require("../controller/facultyController");
const { verifyToken, requireRole, requireAdminSubRole, requirePermission } = require("../middleware/verifyToken");

// Public — students/school heads need to fetch faculty for evaluation forms
router.get("/for-student", getFacultyForStudent);
router.get("/by-department/:department", getFacultyByDepartment);
router.get("/", getAllFaculty);

// Protected — EO or DC with "faculty" permission, OR school head (for adding teachers in their department)
router.post("/", verifyToken, (req, res, next) => {
  const role = req.user?.role;
  if (role === "faculty") return next(); // school heads can add teachers
  if (role === "admin") {
    // Admins need sub-role + permission
    const subRole = req.user?.admin_role;
    if (subRole !== "Executive Office" && subRole !== "Data Center") {
      return res.status(403).json({ success: false, message: "Forbidden. Insufficient role." });
    }
    return next();
  }
  return res.status(403).json({ success: false, message: "Forbidden." });
}, createFaculty);
router.put("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("faculty"), updateFaculty);
router.patch("/:id/toggle", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("faculty"), toggleFacultyStatus);
router.delete("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("faculty"), deleteFaculty);

module.exports = router;
