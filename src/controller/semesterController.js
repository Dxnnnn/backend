const db = require("../config/db");
const crypto = require("crypto");

const VALID_TERMS = new Set(["1st Semester", "2nd Semester", "Summer", "Quarter 1 & 2", "Quarter 3 & 4"]);

function ensureTable(callback) {
  const sql = `
    CREATE TABLE IF NOT EXISTS semesters (
      id VARCHAR(36) NOT NULL,
      school_year VARCHAR(20) NOT NULL,
      term VARCHAR(50) NOT NULL,
      subjects TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_year_term (school_year, term)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  db.query(sql, (err) => callback(err));
}

// GET /api/semesters
const getSemesters = (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) return res.status(500).json({ success: false, message: "Database error.", error: tableErr.message });
    db.query("SELECT * FROM semesters ORDER BY school_year DESC, term ASC", (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      const semesters = rows.map((r) => ({
        id: r.id,
        schoolYear: r.school_year,
        term: r.term,
        subjects: typeof r.subjects === "string" && r.subjects ? JSON.parse(r.subjects) : [],
        isActive: Boolean(r.is_active),
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      }));
      return res.status(200).json({ success: true, semesters });
    });
  });
};

// GET /api/semesters/active — only active semesters (for student/school head form)
const getActiveSemesters = (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) return res.status(500).json({ success: false, message: "Database error.", error: tableErr.message });
    db.query("SELECT * FROM semesters WHERE is_active = 1 ORDER BY school_year DESC, term ASC", (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      const semesters = rows.map((r) => ({
        id: r.id,
        schoolYear: r.school_year,
        term: r.term,
        subjects: typeof r.subjects === "string" && r.subjects ? JSON.parse(r.subjects) : [],
        isActive: true,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      }));
      return res.status(200).json({ success: true, semesters });
    });
  });
};

// POST /api/semesters
const createSemester = (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) return res.status(500).json({ success: false, message: "Database error.", error: tableErr.message });

    const { schoolYear, term, subjects } = req.body ?? {};
    if (!schoolYear?.trim()) return res.status(400).json({ success: false, message: "School year is required." });
    if (!VALID_TERMS.has(term)) return res.status(400).json({ success: false, message: "Invalid semester term." });
    const subjectsArr = Array.isArray(subjects) ? subjects.filter(Boolean) : [];

    const id = crypto.randomUUID();
    db.query(
      "INSERT INTO semesters (id, school_year, term, subjects, is_active) VALUES (?, ?, ?, ?, 1)",
      [id, schoolYear.trim(), term, JSON.stringify(subjectsArr)],
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ success: false, message: "That school year and semester already exists." });
          }
          return res.status(500).json({ success: false, message: "Database error.", error: err.message });
        }
        return res.status(201).json({
          success: true,
          semester: { id, schoolYear: schoolYear.trim(), term, subjects: subjectsArr, isActive: true, createdAt: new Date().toISOString() },
        });
      }
    );
  });
};

// PATCH /api/semesters/:id/toggle — toggle is_active
const toggleSemester = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE semesters SET is_active = NOT is_active WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Semester not found." });
    db.query("SELECT is_active FROM semesters WHERE id = ?", [id], (err2, rows) => {
      const isActive = rows?.[0]?.is_active === 1;
      return res.status(200).json({ success: true, isActive });
    });
  });
};

// DELETE /api/semesters/:id
const deleteSemester = (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM semesters WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Semester not found." });
    return res.status(200).json({ success: true, message: "Semester deleted." });
  });
};

module.exports = { getSemesters, getActiveSemesters, createSemester, toggleSemester, deleteSemester };
