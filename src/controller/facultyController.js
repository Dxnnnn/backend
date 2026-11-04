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
  // FK ON DELETE CASCADE automatically removes evaluation_submissions
  db.query("DELETE FROM faculty WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });
    return res.status(200).json({ success: true, message: "Faculty and their evaluation records deleted." });
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

/**
 * Get faculty members that have subjects matching a student's profile
 * Query params: student_level, year_level, course, grade, strand, section, semester
 */
const getFacultyForStudent = (req, res) => {
  const { student_level, year_level, course, grade, strand, section, semester } = req.query;

  if (!student_level) {
    return res.status(400).json({ success: false, message: "student_level is required." });
  }

  // Map student_level to department
  const department = student_level === "junior-high" ? "junior-high" :
                     student_level === "senior-high" ? "senior-high" : "college";

  // Build query to find subjects matching student's criteria
  let subjectsSql = `SELECT DISTINCT faculty_id FROM subjects WHERE department = ? AND faculty_id IS NOT NULL`;
  const params = [department];

  if (department === "college") {
    if (year_level) { subjectsSql += ` AND year_level = ?`; params.push(year_level); }
    if (course) {
      // Handle comma-separated courses in subject
      subjectsSql += ` AND (course = ? OR course LIKE ? OR course LIKE ? OR course LIKE ?)`;
      params.push(course, `${course},%`, `%,${course}`, `%,${course},%`);
    }
  } else {
    if (grade) {
      // Normalize grade: "Grade 11" -> "11"
      const normalizedGrade = grade.replace(/^Grade\s*/i, '').trim();
      // Handle comma-separated grades in subject
      subjectsSql += ` AND (grade = ? OR grade LIKE ? OR grade LIKE ? OR grade LIKE ?)`;
      params.push(normalizedGrade, `${normalizedGrade},%`, `%,${normalizedGrade}`, `%,${normalizedGrade},%`);
    }
    if (department === "senior-high" && strand) {
      // Handle comma-separated strands in subject
      subjectsSql += ` AND (strand = ? OR strand LIKE ? OR strand LIKE ? OR strand LIKE ?)`;
      params.push(strand, `${strand},%`, `%,${strand}`, `%,${strand},%`);
    }
  }

  // Handle section: if subject has section specified, only show to students in that section
  // If subject has no section (NULL or empty), show to ALL students matching other criteria
  if (section) {
    subjectsSql += ` AND (section = ? OR section IS NULL OR section = '')`;
    params.push(section);
  } else {
    // Student has no section, show subjects with no section requirement
    subjectsSql += ` AND (section IS NULL OR section = '')`;
  }

  // Debug logging
  console.log('[getFacultyForStudent] Query params:', { student_level, year_level, course, grade, strand, section, semester });
  console.log('[getFacultyForStudent] SQL:', subjectsSql);
  console.log('[getFacultyForStudent] Params:', params);

  // Execute subject query to get matching faculty IDs
  db.query(subjectsSql, params, (err, subjectResults) => {
    if (err) {
      console.error('[getFacultyForStudent] Query error:', err);
      return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    }

    console.log('[getFacultyForStudent] Subject results:', subjectResults);

    const facultyIds = subjectResults.map(row => row.faculty_id).filter(Boolean);

    if (facultyIds.length === 0) {
      console.log('[getFacultyForStudent] No matching faculty IDs found');
      return res.status(200).json({ success: true, faculty: [] });
    }

    // Get faculty details for matching faculty IDs
    let facultySql = `SELECT id, name, email, position, department, subjects, semester, profile_image, is_active, created_at 
                      FROM faculty WHERE id IN (${facultyIds.map(() => "?").join(",")}) AND is_active = 1`;
    const facultyParams = [...facultyIds];

    // Apply semester filter if provided
    if (semester && semester !== 'All') {
      facultySql += ` AND (semester LIKE ? OR semester IS NULL OR semester = '')`;
      facultyParams.push(`%${semester}%`);
    }

    facultySql += ` ORDER BY name ASC`;

    db.query(facultySql, facultyParams, (err2, results) => {
      if (err2) {
        console.error('[getFacultyForStudent] Faculty query error:', err2);
        return res.status(500).json({ success: false, message: "Database error.", error: err2.message });
      }
      console.log('[getFacultyForStudent] Faculty results:', results);
      return res.status(200).json({ success: true, faculty: results });
    });
  });
};

module.exports = { 
  createFaculty, 
  getAllFaculty, 
  getFacultyByDepartment, 
  deleteFaculty, 
  toggleFacultyStatus, 
  updateFaculty,
  getFacultyForStudent
};
