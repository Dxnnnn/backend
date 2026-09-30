const db = require("../config/db");

const createFaculty = (req, res) => {
  const { name, email, position, department, subjects, semester, profile_image } = req.body;

  if (!name || !department) {
    return res.status(400).json({ success: false, message: "Name and department are required." });
  }

  const subjectsStr = Array.isArray(subjects) ? subjects.join(",") : (subjects ?? "");
  const sql = `INSERT INTO faculty (name, email, position, department, subjects, semester, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [name.trim(), email?.trim() ?? null, position?.trim() ?? null, department.trim(), subjectsStr, semester ?? null, profile_image ?? null], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Failed to create faculty.", error: err.message });

    return res.status(201).json({
      success: true,
      message: "Faculty created successfully.",
      faculty: {
        id: result.insertId,
        name: name.trim(),
        email: email?.trim() ?? null,
        position: position?.trim() ?? null,
        department: department.trim(),
        subjects: subjectsStr,
        semester: semester ?? null,
        profile_image: profile_image ?? null,
        created_at: new Date().toISOString(),
      },
    });
  });
};

const getAllFaculty = (req, res) => {
  const { semester } = req.query;

  let sql = `SELECT id, name, email, position, department, subjects, semester, profile_image, is_active, created_at FROM faculty`;
  const params = [];

  // Always filter out inactive faculty
  if (semester) {
    if (semester === 'All') {
      // Return all active faculty regardless of semester
      sql += ` WHERE is_active = 1`;
    } else {
      // Match faculty whose semester contains the given term
      // Handles both "1st Semester" and "2025-2026 · 1st Semester" stored formats
      sql += ` WHERE is_active = 1 AND (semester LIKE ? OR semester IS NULL OR semester = '')`;
      params.push(`%${semester}%`);
    }
  } else {
    // No semester filter — still only return active faculty
    sql += ` WHERE is_active = 1`;
  }

  sql += ` ORDER BY name ASC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, faculty: results });
  });
};

const getFacultyByDepartment = (req, res) => {
  const department = decodeURIComponent(req.params.department);
  const { semester } = req.query;

  // Use LIKE so "Senior High School" matches "Senior High School (Grade 11 - STEM - Section A)"
  let sql = `SELECT id, name, email, position, department, subjects, semester, profile_image, created_at FROM faculty WHERE department LIKE ? AND is_active = 1`;
  const params = [`%${department}%`];

  if (semester) {
    sql += ` AND (semester LIKE ? OR semester IS NULL OR semester = '')`;
    params.push(`%${semester}%`);
  }

  sql += ` ORDER BY name ASC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, faculty: results });
  });
};

const deleteFaculty = (req, res) => {
  const { id } = req.params;
  // Delete all evaluation submissions for this faculty first
  db.query("DELETE FROM evaluation_submissions WHERE faculty_id = ?", [String(id)], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });

    // Then delete the faculty
    db.query("DELETE FROM faculty WHERE id = ?", [id], (err2, result) => {
      if (err2) return res.status(500).json({ success: false, message: "Database error.", error: err2.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });
      return res.status(200).json({ success: true, message: "Faculty and their evaluation records deleted." });
    });
  });
};

const toggleFacultyStatus = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE faculty SET is_active = NOT is_active WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });
    return res.status(200).json({ success: true, message: "Faculty status updated." });
  });
};

const updateFaculty = (req, res) => {
  const { id } = req.params;
  const { name, email, position, department, subjects, semester, profile_image } = req.body;

  if (!name || !department) {
    return res.status(400).json({ success: false, message: "Name and department are required." });
  }

  const subjectsStr = Array.isArray(subjects) ? subjects.join(",") : (subjects ?? "");

  db.query(
    "UPDATE faculty SET name=?, email=?, position=?, department=?, subjects=?, semester=?, profile_image=? WHERE id=?",
    [name.trim(), email?.trim() ?? null, position?.trim() ?? null, department.trim(), subjectsStr, semester ?? null, profile_image ?? null, id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to update faculty.", error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });
      return res.status(200).json({ success: true, message: "Faculty updated." });
    }
  );
};

module.exports = { createFaculty, getAllFaculty, getFacultyByDepartment, deleteFaculty, toggleFacultyStatus, updateFaculty };
