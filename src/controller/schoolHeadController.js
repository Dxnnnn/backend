const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "bc_eval_jwt_secret_2026_benedicto_college";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const createSchoolHead = (req, res) => {
  const { id_number, full_name, department, password } = req.body;

  if (!id_number || !full_name || !department || !password) {
    return res.status(400).json({ success: false, message: "ID number, full name, department, and password are required." });
  }

  const checkSql = "SELECT id FROM school_heads WHERE id_number = ?";

  db.query(checkSql, [id_number.trim()], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: "ID number already exists." });

    const hashedPassword = bcrypt.hashSync(password, 12);
    const insertSql = `INSERT INTO school_heads (id_number, full_name, department, password) VALUES (?, ?, ?, ?)`;

    db.query(insertSql, [id_number.trim(), full_name.trim(), department.trim(), hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to create school head.", error: err.message });

      return res.status(201).json({
        success: true,
        message: "School head created successfully.",
        schoolHead: {
          id: result.insertId,
          id_number: id_number.trim(),
          full_name: full_name.trim(),
          department: department.trim(),
          created_at: new Date().toISOString(),
        },
      });
    });
  });
};

const getAllSchoolHeads = (req, res) => {
  const sql = "SELECT id, id_number, full_name, department, is_active, created_at FROM school_heads ORDER BY full_name ASC";

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, schoolHeads: results });
  });
};

const deleteSchoolHead = (req, res) => {
  const { id } = req.params;
  // First get the id_number to delete their submissions
  db.query("SELECT id_number FROM school_heads WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: "School head not found." });

    const idNumber = results[0].id_number;

    // Delete their evaluation submissions (school_head source)
    db.query("DELETE FROM evaluation_submissions WHERE student_id = ? AND source = 'school_head'", [idNumber], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Database error.", error: err2.message });

      // Then delete the school head
      db.query("DELETE FROM school_heads WHERE id = ?", [id], (err3, result) => {
        if (err3) return res.status(500).json({ success: false, message: "Database error.", error: err3.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "School head not found." });
        return res.status(200).json({ success: true, message: "School head and their evaluation records deleted." });
      });
    });
  });
};

const loginSchoolHead = (req, res) => {
  const { id_number, password } = req.body;

  if (!id_number || !password) {
    return res.status(400).json({ success: false, message: "ID number and password are required." });
  }

  const sql = "SELECT * FROM school_heads WHERE id_number = ? AND is_active = 1";

  db.query(sql, [id_number.trim()], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length === 0) return res.status(401).json({ success: false, message: "Invalid ID number or password." });

    const schoolHead = results[0];
    const isMatch = await bcrypt.compare(password, schoolHead.password);

    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid ID number or password." });

    const token = jwt.sign(
      { id: schoolHead.id, username: schoolHead.id_number, role: "faculty" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: schoolHead.id,
        username: schoolHead.id_number,
        full_name: schoolHead.full_name,
        department: schoolHead.department,
        role: "faculty",
      },
    });
  });
};

const toggleSchoolHeadStatus = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE school_heads SET is_active = NOT is_active WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "School head not found." });
    return res.status(200).json({ success: true, message: "School head status updated." });
  });
};

const updateSchoolHead = (req, res) => {
  const { id } = req.params;
  const { id_number, full_name, department } = req.body;

  if (!full_name || !department) {
    return res.status(400).json({ success: false, message: "Full name and department are required." });
  }

  db.query("UPDATE school_heads SET id_number=?, full_name=?, department=? WHERE id=?",
    [id_number?.trim() ?? null, full_name.trim(), department.trim(), id],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ success: false, message: "ID number already exists." });
        }
        return res.status(500).json({ success: false, message: "Failed to update school head.", error: err.message });
      }
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "School head not found." });
      return res.status(200).json({ success: true, message: "School head updated." });
    }
  );
};

module.exports = { createSchoolHead, getAllSchoolHeads, deleteSchoolHead, loginSchoolHead, toggleSchoolHeadStatus, updateSchoolHead };
