const db = require("../config/db");

// POST /api/evaluations — save a new submission
const createEvaluation = (req, res) => {
  const {
    id,
    student_id,
    student_name,
    faculty_id,
    faculty_name,
    department,
    subject,
    semester,
    remarks,
    scoring_answers,
    personal_answers,
    submitted_at,
    source,  // "student" or "school_head"
  } = req.body;

  if (!faculty_id || !faculty_name || !department || !subject || !scoring_answers) {
    return res.status(400).json({ success: false, message: "Required fields missing." });
  }

  // ── Duplicate prevention: one submission per student per faculty per subject per semester ──
  if (student_id) {
    const checkSql = `
      SELECT id FROM evaluation_submissions
      WHERE student_id = ? AND faculty_id = ? AND subject = ? AND (semester = ? OR (semester IS NULL AND ? IS NULL))
      LIMIT 1
    `;
    db.query(checkSql, [student_id, String(faculty_id), subject, semester ?? null, semester ?? null], (checkErr, existing) => {
      if (checkErr) {
        return res.status(500).json({ success: false, message: "Database error.", error: checkErr.message });
      }
      if (existing && existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted an evaluation for this faculty member in this subject and semester.",
          duplicate: true,
        });
      }
      insertSubmission();
    });
  } else {
    insertSubmission();
  }

  function insertSubmission() {
    const submissionId = id || require("crypto").randomUUID();
    const rawDate = submitted_at || new Date().toISOString();
    const submittedAt = rawDate.replace("T", " ").replace("Z", "").split(".")[0];

    // Look up the semester_id from the semester display text (e.g. "SY-2025-2026 1st Semester")
    let schoolYear = null;
    let term = null;
    if (semester) {
      const match = semester.match(/^SY-(.+?)\s+(.+)$/);
      if (match) {
        schoolYear = match[1];
        term = match[2];
      }
    }

    const isSchoolHead = source === "school_head";

    const lookupAndInsert = (semesterId, schoolHeadId) => {
      const sql = `
        INSERT INTO evaluation_submissions
          (id, student_id, student_name, faculty_id, faculty_name, department, subject, semester, semester_id, school_head_id, remarks, scoring_answers, personal_answers, submitted_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
      `;

      db.query(
        sql,
        [
          submissionId,
          student_id ?? null,
          student_name ?? null,
          String(faculty_id),
          faculty_name,
          department,
          subject,
          semester ?? null,
          semesterId ?? null,
          schoolHeadId ?? null,
          remarks ?? null,
          JSON.stringify(scoring_answers),
          JSON.stringify(personal_answers ?? {}),
          submittedAt,
          isSchoolHead ? "school_head" : "student",
        ],
        (err) => {
          if (err) {
            console.error("[evaluations] Database error:", err.message, err.code);
            return res.status(500).json({ success: false, message: `Database error: ${err.message}` });
          }
          return res.status(201).json({ success: true, id: submissionId });
        }
      );
    };

    // Look up semester_id and school_head_id in parallel then insert
    let semesterId = null;
    let schoolHeadId = null;
    let pending = 0;

    function tryInsert() {
      pending--;
      if (pending === 0) lookupAndInsert(semesterId, schoolHeadId);
    }

    // Semester lookup
    if (schoolYear && term) {
      pending++;
      db.query(
        "SELECT id FROM semesters WHERE school_year = ? AND term = ? LIMIT 1",
        [schoolYear, term],
        (err, rows) => {
          if (!err && rows && rows.length > 0) semesterId = rows[0].id;
          tryInsert();
        }
      );
    }

    // School head lookup — student_id stores the school head's id_number when source = school_head
    if (isSchoolHead && student_id) {
      pending++;
      db.query(
        "SELECT id FROM school_heads WHERE id_number = ? LIMIT 1",
        [student_id],
        (err, rows) => {
          if (!err && rows && rows.length > 0) schoolHeadId = rows[0].id;
          tryInsert();
        }
      );
    }

    // If no lookups needed, insert immediately
    if (pending === 0) lookupAndInsert(semesterId, schoolHeadId);
  }
};

// GET /api/evaluations — fetch all submissions
const getEvaluations = (req, res) => {
  const { faculty_id, semester, student_id } = req.query;

  let sql = `SELECT * FROM evaluation_submissions`;
  const params = [];
  const conditions = [];

  if (faculty_id) {
    conditions.push(`faculty_id = ?`);
    params.push(faculty_id);
  }
  if (semester) {
    conditions.push(`semester = ?`);
    params.push(semester);
  }
  if (student_id) {
    conditions.push(`student_id = ?`);
    params.push(student_id);
  }

  // Admin reports: only show student submissions unless explicitly requesting school_head
  const sourceFilter = req.query.source;
  if (sourceFilter === "school_head") {
    conditions.push(`source = 'school_head'`);
  } else if (!sourceFilter) {
    // Default: student submissions only
    conditions.push(`(source = 'student' OR source IS NULL)`);
  }
  // sourceFilter === "all" → no filter, show everything

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(" AND ");
  }

  sql += ` ORDER BY submitted_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    }

    // Parse JSON fields
    const submissions = results.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      facultyId: row.faculty_id,
      facultyName: row.faculty_name,
      department: row.department,
      subject: row.subject,
      semester: row.semester,
      remarks: row.remarks,
      source: row.source,
      scoringAnswers: typeof row.scoring_answers === "string"
        ? JSON.parse(row.scoring_answers)
        : row.scoring_answers,
      personalAnswers: typeof row.personal_answers === "string"
        ? JSON.parse(row.personal_answers)
        : row.personal_answers,
      submittedAt: row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : row.submitted_at,
    }));

    return res.status(200).json({ success: true, submissions });
  });
};

module.exports = { createEvaluation, getEvaluations };
