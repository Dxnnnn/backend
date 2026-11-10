const express = require("express");
const router = express.Router();
const { createEvaluation, getEvaluations } = require("../controller/evaluationController");
const { verifyToken } = require("../middleware/verifyToken");

// Any authenticated user (students submit, admin reads for reports/status)
// Granular report permission checking is handled at the frontend page level;
// the API stays open to any authenticated session so existing student/school-head
// submission flows are not broken.
router.get("/", verifyToken, getEvaluations);
router.post("/", verifyToken, createEvaluation);

module.exports = router;
