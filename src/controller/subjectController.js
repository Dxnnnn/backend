const db = require("../config/db");

const VALID_DEPARTMENTS = new Set(["junior-high", "senior-high", "college"]);
const VALID_YEAR_LEVELS = new Set(["1st Year", "2nd Year", "3rd Year", "4th Year"]);
const VALID_COURSES = new Set(["BSIT", "BSCS", "BSHM", "BSBA", "BSED", "BSCRIM", "BSN", "BSECE"]);
const VALID_GRADES_JH = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
const VALID_GRADES_SHS = new Set(["11", "12"]);
const VALID_STRANDS = new Set(["STEM", "HUMSS", "ABM", "GAS", "TVL", "ICT", "HE", "IA"]);

function mapRow(row) {
  // If faculty_id is NULL (faculty deleted/deactivated), also clear faculty_name
  const facultyId = row.faculty_id ?? null;
  return {
    id: row.id,
    name: row.name,
    department: row.department ?? "college",
    yearLevel: row.year_level ?? null,
    course: row.course ?? null,
    grade: row.grade ?? null,
    strand: row.strand ?? null,
    section: row.section ?? null,
    roomNo: row.room_no ?? null,
    scheduleDay: row.schedule_day ?? null,
    scheduleTime: row.schedule_time ?? null,
    facultyId,
    facultyName: facultyId ? (row.faculty_name ?? null) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/**
 * Rebuilds the faculty.subjects column for a given faculty member
 * by querying all subjects assigned to them in the subjects table.
 * This keeps faculty.subjects in sync automatically.
 */
function syncFacultySubjects(facultyId, callback) {
  if (!facultyId) return callback && callback();
  db.query(
    `SELECT name FROM subjects WHERE faculty_id = ? ORDER BY name ASC`,
    [facultyId],
    (err, rows) => {
      if (err) return callback && callback(err);
      const subjectsStr = (rows ?? []).map((r) => r.name).join(",");
      db.query(
        `UPDATE faculty SET subjects = ? WHERE id = ?`,
        [subjectsStr || null, facultyId],
        (err2) => callback && callback(err2)
      );
    }
  );
}

// GET /api/subjects?department=&course=&year_level=&grade=&strand=
const getSubjects = (req, res) => {
  const { department, course, year_level, grade, strand } = req.query;
  let sql = `SELECT * FROM subjects`;
  const params = [];
  const conditions = [];

  if (department && VALID_DEPARTMENTS.has(department)) {
    conditions.push(`department = ?`); params.push(department);
  }
  if (course) { conditions.push(`course = ?`); params.push(course); }
  if (year_level) { conditions.push(`year_level = ?`); params.push(year_level); }
  if (grade) { conditions.push(`grade = ?`); params.push(grade); }
  if (strand) { conditions.push(`strand = ?`); params.push(strand); }
  if (conditions.length) sql += ` WHERE ` + conditions.join(" AND ");
  sql += ` ORDER BY department ASC, name ASC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, subjects: results.map(mapRow) });
  });
};

// POST /api/subjects
const createSubject = (req, res) => {
  const { name, department, yearLevel, course, grade, strand, section, roomNo, scheduleDay, scheduleTime, facultyId, facultyName } = req.body ?? {};

  if (!name?.trim()) return res.status(400).json({ success: false, message: "Subject name is required." });
  if (!VALID_DEPARTMENTS.has(department)) return res.status(400).json({ success: false, message: "Invalid department." });

  if (department === "college") {
    if (!VALID_YEAR_LEVELS.has(yearLevel)) return res.status(400).json({ success: false, message: "Invalid year level." });
    if (!course) return res.status(400).json({ success: false, message: "Course is required." });
  }
  if (department === "senior-high") {
    if (!grade) return res.status(400).json({ success: false, message: "Grade is required for SHS." });
    if (!strand) return res.status(400).json({ success: false, message: "Strand is required." });
  }
  if (department === "junior-high") {
    if (!grade) return res.status(400).json({ success: false, message: "Grade is required for JHS." });
  }

  db.query(
    `INSERT INTO subjects (name, department, year_level, course, grade, strand, section, room_no, schedule_day, schedule_time, faculty_id, faculty_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(), department,
      department === "college" ? yearLevel : null,
      department === "college" ? course : null,
      department !== "college" ? String(grade) : null,
      department === "senior-high" ? strand : null,
      section ?? null,
      roomNo ?? null,
      scheduleDay ?? null,
      scheduleTime ?? null,
      facultyId ?? null, facultyName ?? null,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to create subject.", error: err.message });

      const newSubject = {
        id: result.insertId, name: name.trim(), department,
        yearLevel: department === "college" ? yearLevel : null,
        course: department === "college" ? course : null,
        grade: department !== "college" ? String(grade) : null,
        strand: department === "senior-high" ? strand : null,
        section: section ?? null,
        roomNo: roomNo ?? null,
        scheduleDay: scheduleDay ?? null,
        scheduleTime: scheduleTime ?? null,
        facultyId: facultyId ?? null, facultyName: facultyName ?? null,
        createdAt: new Date().toISOString(),
      };

      if (facultyId) {
        syncFacultySubjects(facultyId, () => {
          return res.status(201).json({ success: true, subject: newSubject });
        });
      } else {
        return res.status(201).json({ success: true, subject: newSubject });
      }
    }
  );
};

// PUT /api/subjects/:id
const updateSubject = (req, res) => {
  const { id } = req.params;
  const { name, department, yearLevel, course, grade, strand, section, roomNo, scheduleDay, scheduleTime, facultyId, facultyName } = req.body ?? {};

  if (!name?.trim()) return res.status(400).json({ success: false, message: "Subject name is required." });

  db.query(`SELECT faculty_id FROM subjects WHERE id = ?`, [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    const oldFacultyId = rows?.[0]?.faculty_id ?? null;

    db.query(
      `UPDATE subjects SET name=?, department=?, year_level=?, course=?, grade=?, strand=?, section=?, room_no=?, schedule_day=?, schedule_time=?, faculty_id=?, faculty_name=? WHERE id=?`,
      [
        name.trim(), department,
        department === "college" ? yearLevel ?? null : null,
        department === "college" ? course ?? null : null,
        department !== "college" ? String(grade ?? "") : null,
        department === "senior-high" ? strand ?? null : null,
        section ?? null,
        roomNo ?? null,
        scheduleDay ?? null,
        scheduleTime ?? null,
        facultyId ?? null, facultyName ?? null, id,
      ],
      (err2, result) => {
        if (err2) return res.status(500).json({ success: false, message: "Failed to update subject.", error: err2.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Subject not found." });

        // Sync new faculty
        const newFacultyId = facultyId ?? null;
        const facultiesToSync = [...new Set([oldFacultyId, newFacultyId].filter(Boolean))];

        if (facultiesToSync.length === 0) {
          return res.status(200).json({ success: true, message: "Subject updated." });
        }

        let pending = facultiesToSync.length;
        facultiesToSync.forEach((fId) => {
          syncFacultySubjects(fId, () => {
            pending--;
            if (pending === 0) return res.status(200).json({ success: true, message: "Subject updated." });
          });
        });
      }
    );
  });
};

// DELETE /api/subjects/:id
const deleteSubject = (req, res) => {
  const { id } = req.params;

  // Get faculty_id before deleting so we can sync
  db.query(`SELECT faculty_id FROM subjects WHERE id = ?`, [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    const facultyId = rows?.[0]?.faculty_id ?? null;

    db.query(`DELETE FROM subjects WHERE id=?`, [id], (err2, result) => {
      if (err2) return res.status(500).json({ success: false, message: "Database error.", error: err2.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Subject not found." });

      // Sync faculty subjects after deletion
      if (facultyId) {
        syncFacultySubjects(facultyId, () => {
          return res.status(200).json({ success: true, message: "Subject deleted." });
        });
      } else {
        return res.status(200).json({ success: true, message: "Subject deleted." });
      }
    });
  });
};

module.exports = { getSubjects, createSubject, updateSubject, deleteSubject };

