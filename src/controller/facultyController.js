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
  const { semester, include_empty_subjects } = req.query;

  // Use LIKE so "Senior High School" matches "Senior High School (Grade 11 - STEM - Section A)"
  // For the school head evaluate flow, exclude faculty with no assigned subjects.
  // For the admin subjects-assignment dropdown, include_empty_subjects=1 bypasses that filter.
  const skipEmptyFilter = include_empty_subjects === '1';
  let sql = `SELECT id, name, email, position, department, subjects, semester, profile_image, created_at FROM faculty WHERE department LIKE ? AND is_active = 1`;
  if (!skipEmptyFilter) {
    sql += ` AND subjects IS NOT NULL AND TRIM(subjects) != ''`;
  }
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
  // First clear this faculty from any assigned subjects (set assigned teacher to NULL)
  db.query(
    "UPDATE subjects SET faculty_id = NULL, faculty_name = NULL WHERE faculty_id = ?",
    [id],
    (errClear) => {
      if (errClear) return res.status(500).json({ success: false, message: "Database error clearing subjects.", error: errClear.message });
      // Now delete the faculty record (FK CASCADE removes evaluation_submissions)
      db.query("DELETE FROM faculty WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });
        return res.status(200).json({ success: true, message: "Faculty deleted and subject assignments cleared." });
      });
    }
  );
};

const toggleFacultyStatus = (req, res) => {
  const { id } = req.params;
  // Get current status first
  db.query("SELECT is_active FROM faculty WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (!rows.length) return res.status(404).json({ success: false, message: "Faculty not found." });

    const currentlyActive = rows[0].is_active === 1;

    // Toggle the status
    db.query("UPDATE faculty SET is_active = NOT is_active WHERE id = ?", [id], (err2, result) => {
      if (err2) return res.status(500).json({ success: false, message: "Database error.", error: err2.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });

      // If we just DEACTIVATED (was active → now inactive), clear subject assignments
      if (currentlyActive) {
        db.query(
          "UPDATE subjects SET faculty_id = NULL, faculty_name = NULL WHERE faculty_id = ?",
          [id],
          () => {
            // Non-fatal — proceed regardless
            return res.status(200).json({ success: true, message: "Faculty deactivated and subject assignments cleared." });
          }
        );
      } else {
        return res.status(200).json({ success: true, message: "Faculty activated." });
      }
    });
  });
};

const updateFaculty = (req, res) => {
  const { id } = req.params;
  const { name, email, position, department, subjects, semester, profile_image } = req.body;

  if (!name || !department) {
    return res.status(400).json({ success: false, message: "Name and department are required." });
  }

  // If subjects not provided in the request, preserve the existing value from DB
  if (subjects === undefined) {
    db.query(
      "UPDATE faculty SET name=?, email=?, position=?, department=?, semester=?, profile_image=? WHERE id=?",
      [name.trim(), email?.trim() ?? null, position?.trim() ?? null, department.trim(), semester ?? null, profile_image ?? null, id],
      (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to update faculty.", error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Faculty not found." });
        return res.status(200).json({ success: true, message: "Faculty updated." });
      }
    );
    return;
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
  const { student_level, year_level, course, grade, strand, section, semester, subjects } = req.query;

  if (!student_level) {
    return res.status(400).json({ success: false, message: "student_level is required." });
  }

  // If specific subjects are saved for this student, filter directly by subject names
  if (subjects && typeof subjects === "string" && subjects.trim()) {
    const subjectList = subjects.split(",").map((s) => s.trim()).filter(Boolean);
    if (subjectList.length > 0) {
      // Map student_level to the subjects.department enum value
      const deptForLevel = student_level === "junior-high" ? "junior-high" :
                           student_level === "senior-high" ? "senior-high" : "college";

      const placeholders = subjectList.map(() => "?").join(",");
      const sql = `
        SELECT DISTINCT f.id, f.name, f.email, f.position, f.department, f.subjects,
                        f.semester, f.profile_image, f.is_active, f.created_at,
                        sub.name AS matched_subject, sub.room_no, sub.schedule_day, sub.schedule_time
        FROM subjects sub
        JOIN faculty f ON f.id = sub.faculty_id
        WHERE sub.name IN (${placeholders})
          AND sub.department = ?
          AND f.is_active = 1
          AND sub.faculty_id IS NOT NULL
        ORDER BY f.name ASC
      `;
      db.query(sql, [...subjectList, deptForLevel], (err, results) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Database error.", error: err.message });
        }
        // Build faculty array with matched subjects grouped by faculty
        const facultyMap = new Map();
        for (const row of (results || [])) {
          if (!facultyMap.has(row.id)) {
            facultyMap.set(row.id, {
              id: row.id, name: row.name, email: row.email, position: row.position,
              department: row.department, subjects: row.subjects, semester: row.semester,
              profile_image: row.profile_image, is_active: row.is_active, created_at: row.created_at,
              matchedSubjects: [],
            });
          }
          if (row.matched_subject) {
            facultyMap.get(row.id).matchedSubjects.push({
              name: row.matched_subject,
              roomNo: row.room_no,
              scheduleDay: row.schedule_day,
              scheduleTime: row.schedule_time,
            });
          }
        }
        return res.status(200).json({ success: true, faculty: Array.from(facultyMap.values()) });
      });
      return; // prevent fall-through to the rest of the function
    }
  }

  // is_irregular flag — irregular students skip section filtering
  const isIrregular = req.query.is_irregular === "true" || req.query.is_irregular === "1";

  // Map student_level to department
  const department = student_level === "junior-high" ? "junior-high" :
                     student_level === "senior-high" ? "senior-high" : "college";

  // Build query to find subjects matching student's criteria
  let subjectsSql = `SELECT DISTINCT faculty_id FROM subjects WHERE department = ? AND faculty_id IS NOT NULL`;
  const params = [department];

  if (department === "college") {
    if (year_level) { subjectsSql += ` AND year_level = ?`; params.push(year_level); }
    if (course) {
      subjectsSql += ` AND (course = ? OR course LIKE ? OR course LIKE ? OR course LIKE ?)`;
      params.push(course, `${course},%`, `%,${course}`, `%,${course},%`);
    }
  } else {
    if (grade) {
      const normalizedGrade = grade.replace(/^Grade\s*/i, '').trim();
      subjectsSql += ` AND (grade = ? OR grade LIKE ? OR grade LIKE ? OR grade LIKE ?)`;
      params.push(normalizedGrade, `${normalizedGrade},%`, `%,${normalizedGrade}`, `%,${normalizedGrade},%`);
    }
    if (department === "senior-high" && strand) {
      subjectsSql += ` AND (strand = ? OR strand LIKE ? OR strand LIKE ? OR strand LIKE ?)`;
      params.push(strand, `${strand},%`, `%,${strand}`, `%,${strand},%`);
    }
  }

  // Irregular students: skip section filter entirely — they see all sections
  // Regular students: only see subjects matching their section (or subjects with no section)
  if (!isIrregular) {
    if (section) {
      subjectsSql += ` AND (section = ? OR section IS NULL OR section = '')`;
      params.push(section);
    } else {
    // Student has no section, show subjects with no section requirement
    subjectsSql += ` AND (section IS NULL OR section = '')`;
    }
  } // end !isIrregular

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

    // Also get the actual matching subject names for each faculty
    // so frontend only shows relevant subjects per teacher
    let matchingSubjectsSql = `SELECT faculty_id, name, room_no, schedule_day, schedule_time FROM subjects WHERE department = ? AND faculty_id IS NOT NULL AND faculty_id IN (${facultyIds.map(() => "?").join(",")})`;
    const matchingSubjectsParams = [department, ...facultyIds];

    if (department === "college") {
      if (year_level) { matchingSubjectsSql += ` AND year_level = ?`; matchingSubjectsParams.push(year_level); }
      if (course) {
        matchingSubjectsSql += ` AND (course = ? OR course LIKE ? OR course LIKE ? OR course LIKE ?)`;
        matchingSubjectsParams.push(course, `${course},%`, `%,${course}`, `%,${course},%`);
      }
    } else {
      if (grade) {
        const normalizedGrade = grade.replace(/^Grade\s*/i, '').trim();
        matchingSubjectsSql += ` AND (grade = ? OR grade LIKE ? OR grade LIKE ? OR grade LIKE ?)`;
        matchingSubjectsParams.push(normalizedGrade, `${normalizedGrade},%`, `%,${normalizedGrade}`, `%,${normalizedGrade},%`);
      }
      if (department === "senior-high" && strand) {
        matchingSubjectsSql += ` AND (strand = ? OR strand LIKE ? OR strand LIKE ? OR strand LIKE ?)`;
        matchingSubjectsParams.push(strand, `${strand},%`, `%,${strand}`, `%,${strand},%`);
      }
    }
    if (section) {
      matchingSubjectsSql += ` AND (section = ? OR section IS NULL OR section = '')`;
      matchingSubjectsParams.push(section);
    } else {
      matchingSubjectsSql += ` AND (section IS NULL OR section = '')`;
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

    // Run both queries in parallel
    db.query(matchingSubjectsSql, matchingSubjectsParams, (errS, subjectNameResults) => {
      if (errS) {
        console.error('[getFacultyForStudent] Subject names query error:', errS);
        return res.status(500).json({ success: false, message: "Database error.", error: errS.message });
      }

      // Build a map: facultyId -> [{ name, roomNo, scheduleDay, scheduleTime }, ...]
      const subjectsByFaculty = new Map();
      for (const row of subjectNameResults) {
        if (!subjectsByFaculty.has(row.faculty_id)) subjectsByFaculty.set(row.faculty_id, []);
        subjectsByFaculty.get(row.faculty_id).push({
          name: row.name,
          roomNo: row.room_no ?? null,
          scheduleDay: row.schedule_day ?? null,
          scheduleTime: row.schedule_time ?? null,
        });
      }

    db.query(facultySql, facultyParams, (err2, results) => {
      if (err2) {
        console.error('[getFacultyForStudent] Faculty query error:', err2);
        return res.status(500).json({ success: false, message: "Database error.", error: err2.message });
      }

      // Override each faculty's subjects with only the matching ones (with room/schedule)
      const filteredFaculty = results.map(f => ({
        ...f,
        subjects: subjectsByFaculty.has(f.id)
          ? subjectsByFaculty.get(f.id).map(s => s.name).join(",")
          : f.subjects,
        subjectDetails: subjectsByFaculty.get(f.id) ?? [],
      }));

      console.log('[getFacultyForStudent] Faculty results:', filteredFaculty);
      return res.status(200).json({ success: true, faculty: filteredFaculty });
    });
    }); // close matchingSubjectsSql callback
  }); // close subjectsSql callback
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
