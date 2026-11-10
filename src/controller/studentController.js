const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "bc_eval_jwt_secret_2026_benedicto_college";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// Helper: generate a secure password for students
function generateStudentPassword(student_id, last_name) {
  const prefix = "BC";
  const namePart = (last_name || "").replace(/\s+/g, "").slice(0, 3).toLowerCase();
  const idPart = (student_id || "").replace(/\D/g, "").slice(-4);
  const random = Math.floor(10 + Math.random() * 90);
  return `${prefix}${namePart}${idPart}${random}`;
}

const createStudent = (req, res) => {
  const { student_id, first_name, last_name, email, student_level, grade, year_level, section, strand, course, subjects, is_irregular } = req.body;

  if (!student_id || !first_name || !last_name || !email || !student_level) {
    return res.status(400).json({ success: false, message: "Student ID, name, email, and student level are required." });
  }

  const checkSql = "SELECT id FROM students WHERE student_id = ? OR email = ?";

  db.query(checkSql, [student_id.trim(), email.trim()], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: "Student ID or email already exists." });

    const plainPassword = generateStudentPassword(student_id.trim(), last_name.trim());
    const hashedPassword = bcrypt.hashSync(plainPassword, 12);
    const subjectsStr = Array.isArray(subjects) ? subjects.join(",") : (subjects ?? null);
    const irregularFlag = is_irregular ? 1 : 0;

    const insertSql = `
      INSERT INTO students (student_id, first_name, last_name, email, password, student_level, grade, year_level, section, strand, course, subjects, is_irregular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertSql, [
      student_id.trim(), first_name.trim(), last_name.trim(), email.trim(),
      hashedPassword, student_level, grade ?? null, year_level ?? null,
      section ?? null, strand ?? null, course ?? null, subjectsStr, irregularFlag,
    ], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to create student.", error: err.message });

      return res.status(201).json({
        success: true,
        message: "Student created successfully.",
        generatedPassword: plainPassword,
        student: {
          id: result.insertId,
          student_id: student_id.trim(),
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim(),
          student_level,
          is_irregular: irregularFlag,
          subjects: subjectsStr,
          created_at: new Date().toISOString(),
        },
      });
    });
  });
};

const getAllStudents = (req, res) => {
  const { student_level, year_level, course, grade, strand } = req.query;
  
  let sql = `
    SELECT id, student_id, first_name, last_name, email,
           student_level, grade, year_level, section, strand, course, subjects, is_active, created_at
    FROM students WHERE 1=1
  `;
  
  const params = [];
  
  if (student_level) {
    sql += " AND student_level = ?";
    params.push(student_level);
  }
  
  if (year_level) {
    sql += " AND year_level = ?";
    params.push(year_level);
  }
  
  if (course) {
    sql += " AND course = ?";
    params.push(course);
  }
  
  if (grade) {
    sql += " AND grade = ?";
    params.push(grade);
  }
  
  if (strand) {
    sql += " AND strand = ?";
    params.push(strand);
  }
  
  sql += " ORDER BY last_name ASC, first_name ASC";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, students: results });
  });
};

const deleteStudent = (req, res) => {
  const { id } = req.params;
  // First get the student_id to delete their submissions
  db.query("SELECT student_id FROM students WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Student not found." });

    const studentId = results[0].student_id;

    // Delete their evaluation submissions first
    db.query("DELETE FROM evaluation_submissions WHERE student_id = ?", [studentId], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Database error.", error: err2.message });

      // Then delete the student
      db.query("DELETE FROM students WHERE id = ?", [id], (err3, result) => {
        if (err3) return res.status(500).json({ success: false, message: "Database error.", error: err3.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Student not found." });
        return res.status(200).json({ success: true, message: "Student and their evaluation records deleted." });
      });
    });
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
        is_irregular: student.is_irregular === 1,
        subjects: student.subjects ?? null,
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
  const { student_id, first_name, last_name, email, student_level, grade, year_level, section, strand, course, subjects, is_irregular } = req.body;

  if (!first_name || !last_name || !email || !student_level) {
    return res.status(400).json({ success: false, message: "Name, email, and student level are required." });
  }

  const subjectsStr = Array.isArray(subjects) ? subjects.join(",") : (subjects ?? null);
  const irregularFlag = is_irregular ? 1 : 0;

  const sql = `
    UPDATE students SET student_id=?, first_name=?, last_name=?, email=?, student_level=?,
    grade=?, year_level=?, section=?, strand=?, course=?, subjects=?, is_irregular=? WHERE id=?
  `;

  db.query(sql, [
    student_id?.trim() ?? null,
    first_name.trim(), last_name.trim(), email.trim(), student_level,
    grade ?? null, year_level ?? null, section ?? null, strand ?? null, course ?? null, subjectsStr, irregularFlag, id,
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

/**
 * Get students assigned to a specific faculty member based on their subject assignments
 * This queries students that match the criteria of subjects taught by the faculty
 * GET /api/students/by-faculty/:facultyId
 */
const getStudentsByFaculty = (req, res) => {
  const { facultyId } = req.params;

  // First get all subjects taught by this faculty
  const subjectsQuery = `SELECT * FROM subjects WHERE faculty_id = ?`;
  
  db.query(subjectsQuery, [facultyId], (err, subjects) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (subjects.length === 0) {
      return res.status(200).json({ success: true, students: [] });
    }

    // Build a query to find students matching any of the subject criteria
    const studentQueries = [];
    const allParams = [];

    subjects.forEach(subject => {
      let sql = `SELECT DISTINCT 
        s.id, s.student_id, s.first_name, s.last_name, s.email,
        s.student_level, s.grade, s.year_level, s.section, s.strand, s.course,
        s.is_active, s.created_at
      FROM students s WHERE s.is_active = 1 AND s.student_level = ?`;
      
      const params = [
        subject.department === "junior-high" ? "junior-high" : 
        subject.department === "senior-high" ? "senior-high" : "college"
      ];

      if (subject.department === "college") {
        if (subject.year_level) { 
          sql += ` AND s.year_level = ?`; 
          params.push(subject.year_level); 
        }
        if (subject.course) {
          const courses = subject.course.split(",").map(c => c.trim()).filter(Boolean);
          if (courses.length > 0) {
            sql += ` AND s.course IN (${courses.map(() => "?").join(",")})`;
            params.push(...courses);
          }
        }
      } else {
        if (subject.grade) {
          const grades = subject.grade.split(",").map(g => g.trim()).filter(Boolean);
          if (grades.length > 0) {
            sql += ` AND s.grade IN (${grades.map(() => "?").join(",")})`;
            params.push(...grades);
          }
        }
        if (subject.department === "senior-high" && subject.strand) {
          const strands = subject.strand.split(",").map(s => s.trim()).filter(Boolean);
          if (strands.length > 0) {
            sql += ` AND s.strand IN (${strands.map(() => "?").join(",")})`;
            params.push(...strands);
          }
        }
      }

      studentQueries.push({ sql, params });
    });

    // Execute all queries and combine results
    let allStudents = [];
    let pending = studentQueries.length;
    const studentMap = new Map(); // To avoid duplicates

    studentQueries.forEach(({ sql, params }) => {
      db.query(sql, params, (err2, students) => {
        if (!err2 && students) {
          students.forEach(student => {
            if (!studentMap.has(student.id)) {
              studentMap.set(student.id, student);
            }
          });
        }
        pending--;
        if (pending === 0) {
          allStudents = Array.from(studentMap.values());
          allStudents.sort((a, b) => {
            const lastNameCompare = a.last_name.localeCompare(b.last_name);
            if (lastNameCompare !== 0) return lastNameCompare;
            return a.first_name.localeCompare(b.first_name);
          });
          return res.status(200).json({ success: true, students: allStudents });
        }
      });
    });
  });
};

const resetStudentPassword = (req, res) => {
  const { id } = req.params;
  db.query("SELECT student_id, last_name FROM students WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (!rows.length) return res.status(404).json({ success: false, message: "Student not found." });

    const { student_id, last_name } = rows[0];
    const plainPassword = generateStudentPassword(student_id, last_name);
    const hashedPassword = bcrypt.hashSync(plainPassword, 12);

    db.query("UPDATE students SET password = ? WHERE id = ?", [hashedPassword, id], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Failed to reset password.", error: err2.message });
      return res.status(200).json({ success: true, generatedPassword: plainPassword });
    });
  });
};

const getMyProfile = (req, res) => {
  // req.user is set by verifyToken middleware
  const studentId = req.user?.username; // username = student_id string
  if (!studentId) return res.status(401).json({ success: false, message: "Unauthorized." });

  db.query(
    `SELECT id, student_id, first_name, last_name, email, student_level,
            grade, year_level, section, strand, course, subjects, is_irregular, is_active
     FROM students WHERE student_id = ? AND is_active = 1`,
    [studentId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      if (!rows.length) return res.status(404).json({ success: false, message: "Student not found." });
      return res.status(200).json({ success: true, student: rows[0] });
    }
  );
};

module.exports = { 
  createStudent, 
  getAllStudents, 
  deleteStudent, 
  loginStudent, 
  toggleStudentStatus, 
  updateStudent,
  getStudentsByFaculty,
  resetStudentPassword,
  getMyProfile,
};
