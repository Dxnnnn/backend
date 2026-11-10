const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "bc_eval_jwt_secret_2026_benedicto_college";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// Helper: generate a secure password for school heads
function generateSchoolHeadPassword(id_number, full_name) {
  const prefix = "BC";
  const namePart = (full_name || "").replace(/\s+/g, "").slice(0, 3).toLowerCase();
  const idPart = (id_number || "").replace(/\D/g, "").slice(-3);
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}${namePart}${idPart}${random}`;
}

const createSchoolHead = (req, res) => {
  const { id_number, full_name, department } = req.body;

  if (!id_number || !full_name || !department) {
    return res.status(400).json({ success: false, message: "ID number, full name, and department are required." });
  }

  const checkSql = "SELECT id FROM school_heads WHERE id_number = ?";

  db.query(checkSql, [id_number.trim()], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: "ID number already exists." });

    // Auto-generate password
    const plainPassword = generateSchoolHeadPassword(id_number.trim(), full_name.trim());
    const hashedPassword = bcrypt.hashSync(plainPassword, 12);
    const insertSql = `INSERT INTO school_heads (id_number, full_name, department, password) VALUES (?, ?, ?, ?)`;

    db.query(insertSql, [id_number.trim(), full_name.trim(), department.trim(), hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to create school head.", error: err.message });

      return res.status(201).json({
        success: true,
        message: "School head created successfully.",
        // Return plaintext password ONCE so admin can share it
        generatedPassword: plainPassword,
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
  db.query("SELECT id, id_number FROM school_heads WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: "School head not found." });

    const idNumber = results[0].id_number;

    // Delete their evaluation submissions using school_head_id FK
    db.query("DELETE FROM evaluation_submissions WHERE school_head_id = ? AND source = 'school_head'", [results[0].id], (err2) => {
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

const resetSchoolHeadPassword = (req, res) => {
  const { id } = req.params;
  db.query("SELECT id_number, full_name FROM school_heads WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (!rows.length) return res.status(404).json({ success: false, message: "School head not found." });

    const { id_number, full_name } = rows[0];
    const plainPassword = generateSchoolHeadPassword(id_number, full_name);
    const hashedPassword = bcrypt.hashSync(plainPassword, 12);

    db.query("UPDATE school_heads SET password = ? WHERE id = ?", [hashedPassword, id], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Failed to reset password.", error: err2.message });
      return res.status(200).json({ success: true, generatedPassword: plainPassword });
    });
  });
};

const changeSchoolHeadPassword = (req, res) => {
  const { newPassword } = req.body ?? {};
  const idNumber = req.user?.username; // username = id_number in JWT

  if (!newPassword) {
    return res.status(400).json({ success: false, message: "New password is required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
  }

  const hashed = bcrypt.hashSync(newPassword, 12);
  db.query("UPDATE school_heads SET password = ? WHERE id_number = ? AND is_active = 1", [hashed, idNumber], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Failed to update password.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "School head not found." });
    return res.status(200).json({ success: true, message: "Password updated successfully." });
  });
};

const getMySchoolHeadProfile = (req, res) => {
  const idNumber = req.user?.username;
  db.query(
    "SELECT id, id_number, full_name, department, is_active FROM school_heads WHERE id_number = ? AND is_active = 1",
    [idNumber],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      if (!rows.length) return res.status(404).json({ success: false, message: "School head not found." });
      return res.status(200).json({ success: true, schoolHead: rows[0] });
    }
  );
};

module.exports = { createSchoolHead, getAllSchoolHeads, deleteSchoolHead, loginSchoolHead, toggleSchoolHeadStatus, updateSchoolHead, resetSchoolHeadPassword, changeSchoolHeadPassword, getMySchoolHeadProfile };
