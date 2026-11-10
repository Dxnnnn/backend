const express = require("express");
const router = express.Router();
const {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  bulkStatus,
  bulkCreate,
} = require("../controller/surveyQuestionController");
const { verifyToken, requireRole, requireAdminSubRole, requirePermission } = require("../middleware/verifyToken");

// Public — evaluation forms need questions
router.get("/", getQuestions);

// Protected — student questionnaire
router.post("/", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("questionnaire.student"), createQuestion);
router.post("/reorder", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), (req, res, next) => {
  // reorder can apply to either questionnaire type — allow if either permission is granted
  const db = require("../config/db");
  if (req.user.admin_role === "Super Admin") return next();
  db.query(
    "SELECT permission FROM admin_permissions WHERE admin_id = ? AND permission IN (?, ?) AND granted = 1",
    [req.user.id, "questionnaire.student", "questionnaire.school_head"],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });
      if (!rows.length) return res.status(403).json({ success: false, message: "Forbidden." });
      return next();
    }
  );
}, reorderQuestions);
router.post("/bulk-status", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), (req, res, next) => {
  const db = require("../config/db");
  if (req.user.admin_role === "Super Admin") return next();
  db.query(
    "SELECT permission FROM admin_permissions WHERE admin_id = ? AND permission IN (?, ?) AND granted = 1",
    [req.user.id, "questionnaire.student", "questionnaire.school_head"],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });
      if (!rows.length) return res.status(403).json({ success: false, message: "Forbidden." });
      return next();
    }
  );
}, bulkStatus);
router.post("/bulk", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), (req, res, next) => {
  const db = require("../config/db");
  if (req.user.admin_role === "Super Admin") return next();
  db.query(
    "SELECT permission FROM admin_permissions WHERE admin_id = ? AND permission IN (?, ?) AND granted = 1",
    [req.user.id, "questionnaire.student", "questionnaire.school_head"],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });
      if (!rows.length) return res.status(403).json({ success: false, message: "Forbidden." });
      return next();
    }
  );
}, bulkCreate);
router.put("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), (req, res, next) => {
  const db = require("../config/db");
  if (req.user.admin_role === "Super Admin") return next();
  db.query(
    "SELECT permission FROM admin_permissions WHERE admin_id = ? AND permission IN (?, ?) AND granted = 1",
    [req.user.id, "questionnaire.student", "questionnaire.school_head"],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });
      if (!rows.length) return res.status(403).json({ success: false, message: "Forbidden." });
      return next();
    }
  );
}, updateQuestion);
router.delete("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), (req, res, next) => {
  const db = require("../config/db");
  if (req.user.admin_role === "Super Admin") return next();
  db.query(
    "SELECT permission FROM admin_permissions WHERE admin_id = ? AND permission IN (?, ?) AND granted = 1",
    [req.user.id, "questionnaire.student", "questionnaire.school_head"],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });
      if (!rows.length) return res.status(403).json({ success: false, message: "Forbidden." });
      return next();
    }
  );
}, deleteQuestion);

module.exports = router;
