const express = require("express");
const router = express.Router();
const { getSubjects, createSubject, updateSubject, deleteSubject } = require("../controller/subjectController");
const { verifyToken, requireRole } = require("../middleware/verifyToken");

router.get("/", getSubjects);
router.post("/", verifyToken, requireRole("admin"), createSubject);
router.put("/:id", verifyToken, requireRole("admin"), updateSubject);
router.delete("/:id", verifyToken, requireRole("admin"), deleteSubject);

module.exports = router;
