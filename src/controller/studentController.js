const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "bc_eval_jwt_secret_2026_benedicto_college";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const createStudent = (req, res) => {
  const { student_id, first_name, last_name, email, password, student_level, grade, year_level, section, strand, course } = req.body;

  if (!student_id || !first_name || !last_name || !email || !password || !student_level) {
    return res.status(400).json({ success: false, message: "Student ID, name, email, password, and student level are required." });
  }

  const checkSql = "SELECT id FROM students WHERE student_id = ? OR email = ?";

  db.query(checkSql, [student_id.trim(), email.trim()], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: "Student ID or email already exists." });

    const hashedPassword = bcrypt.hashSync(password, 12);
    const insertSql = `
      INSERT INTO students (student_id, first_name, last_name, email, password, student_level, grade, year_level, section, strand, course)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertSql, [
      student_id.trim(), first_name.trim(), last_name.trim(), email.trim(),
      hashedPassword, student_level, grade ?? null, year_level ?? null,
      section ?? null, strand ?? null, course ?? null,
    ], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to create student.", error: err.message });

      return res.status(201).json({
        success: true,
        message: "Student created successfully.",
        student: {
          id: result.insertId,
          student_id: student_id.trim(),
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim(),
          student_level,
          created_at: new Date().toISOString(),
        },
      });
    });
  });
};

const getAllStudents = (req, res) => {
  const sql = `
    SELECT id, student_id, first_name, last_name, email,
           student_level, grade, year_level, section, strand, course, is_active, created_at
    FROM students ORDER BY last_name ASC, first_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, students: results });
  });
};

const deleteStudent = (req, res) => {
  db.query("DELETE FROM students WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Student not found." });
    return res.status(200).json({ success: true, message: "Student deleted." });
  });
};

const loginStudent = (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    return res.status(400).json({ success: false, message: "Student ID and password are required." });
  }

  db.query("SELECT * FROM students WHERE student_id = ? AND is_active = 1", [student_id.trim()], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length === 0) return res.status(401).json({ success: false, message: "Invalid Student ID or password." });

    const student = results[0];
    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid Student ID or password." });

    const token = jwt.sign(
      { id: student.id, username: student.student_id, role: "user" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: student.id,
        username: student.student_id,
        full_name: `${student.first_name} ${student.last_name}`,
        email: student.email,
        student_level: student.student_level,
        grade: student.grade ?? null,
        year_level: student.year_level ?? null,
        strand: student.strand ?? null,
        course: student.course ?? null,
        section: student.section ?? null,
        role: "user",
      },
    });
  });
};

const toggleStudentStatus = (req, res) => {
  const { id } = req.params;
  const sql = "UPDATE students SET is_active = NOT is_active WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Student not found." });
    return res.status(200).json({ success: true, message: "Student status updated." });
  });
};

const updateStudent = (req, res) => {
  const { id } = req.params;
  const { student_id, first_name, last_name, email, student_level, grade, year_level, section, strand, course } = req.body;

  if (!first_name || !last_name || !email || !student_level) {
    return res.status(400).json({ success: false, message: "Name, email, and student level are required." });
  }

  const sql = `
    UPDATE students SET student_id=?, first_name=?, last_name=?, email=?, student_level=?,
    grade=?, year_level=?, section=?, strand=?, course=? WHERE id=?
  `;

  db.query(sql, [
    student_id?.trim() ?? null,
    first_name.trim(), last_name.trim(), email.trim(), student_level,
    grade ?? null, year_level ?? null, section ?? null, strand ?? null, course ?? null, id,
  ], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "Student ID already exists." });
      }
      return res.status(500).json({ success: false, message: "Failed to update student.", error: err.message });
    }
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Student not found." });
    return res.status(200).json({ success: true, message: "Student updated." });
  });
};

module.exports = { createStudent, getAllStudents, deleteStudent, loginStudent, toggleStudentStatus, updateStudent };
