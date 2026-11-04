const db = require("../config/db");
const crypto = require("crypto");

const VALID_AUDIENCES = new Set(["student", "school_head"]);
const VALID_LEVELS = new Set(["all", "junior-high", "senior-high", "college"]);
const VALID_TYPES = new Set(["rating", "essay", "yes_no"]);
const VALID_STATUS = new Set(["published", "draft"]);

function mapRow(row) {
  return {
    id: row.id,
    text: row.text,
    audience: row.audience,
    studentLevel: row.student_level || "all",
    section: row.section || "scoring",
    category: row.category || "Other",
    evaluationType: row.evaluation_type || "rating",
    required: Boolean(row.required),
    isActive: Boolean(row.is_active),
    status: row.status || "draft",
    order: Number(row.sort_order) || 0,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

function ensureTable(callback) {
  const sql = `
    CREATE TABLE IF NOT EXISTS survey_questions (
      id VARCHAR(36) NOT NULL,
      text TEXT NOT NULL,
      audience ENUM('student', 'school_head') NOT NULL DEFAULT 'student',
      section VARCHAR(50) NOT NULL DEFAULT 'scoring',
      category VARCHAR(100) NOT NULL DEFAULT 'Other',
      evaluation_type ENUM('rating', 'essay', 'yes_no') NOT NULL DEFAULT 'rating',
      required TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      status ENUM('published', 'draft') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audience (audience),
      KEY idx_active (is_active),
      KEY idx_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;
  db.query(sql, (err) => callback(err));
}

// GET /api/survey-questions?audience=&section=&active_only=
const getQuestions = (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({ success: false, message: "Database error.", error: tableErr.message });
    }

    const { audience, section, active_only, student_level } = req.query;
    let sql = `SELECT * FROM survey_questions`;
    const params = [];
    const conditions = [];

    if (audience && VALID_AUDIENCES.has(String(audience))) {
      conditions.push(`audience = ?`);
      params.push(audience);
    }
    if (section) {
      conditions.push(`section = ?`);
      params.push(section);
    }
    if (student_level && VALID_LEVELS.has(String(student_level))) {
      conditions.push(`(student_level = ? OR student_level = 'all')`);
      params.push(student_level);
    }
    if (active_only === "1" || active_only === "true") {
      conditions.push(`is_active = 1`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }
    sql += ` ORDER BY sort_order ASC, created_at ASC`;

    db.query(sql, params, (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      }
      return res.status(200).json({ success: true, questions: results.map(mapRow) });
    });
  });
};

// POST /api/survey-questions
const createQuestion = (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({ success: false, message: "Database error.", error: tableErr.message });
    }

    const {
      id,
      text,
      audience = "student",
      studentLevel = "all",
      section = "scoring",
      category = "Other",
      evaluationType = "rating",
      required = true,
      isActive = true,
      status = "draft",
      order,
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: "Question text is required." });
    }
    if (!VALID_AUDIENCES.has(audience)) {
      return res.status(400).json({ success: false, message: "Invalid audience." });
    }
    if (!VALID_TYPES.has(evaluationType)) {
      return res.status(400).json({ success: false, message: "Invalid evaluation type." });
    }

    const questionId = id || crypto.randomUUID();
    const evaluation_type = evaluationType;
    const is_active = isActive ? 1 : 0;
    const requiredFlag = required === false ? 0 : 1;
    const statusVal = VALID_STATUS.has(status) ? status : "draft";
    const levelVal = VALID_LEVELS.has(studentLevel) ? studentLevel : "all";

    const insert = (sortOrder) => {
      const sql = `
        INSERT INTO survey_questions
          (id, text, audience, student_level, section, category, evaluation_type, required, is_active, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        sql,
        [
          questionId,
          String(text).trim(),
          audience,
          levelVal,
          section || "scoring",
          category || "Other",
          evaluation_type,
          requiredFlag,
          is_active,
          statusVal,
          sortOrder,
        ],
        (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: "Failed to create question.", error: err.message });
          }
          db.query(`SELECT * FROM survey_questions WHERE id = ?`, [questionId], (getErr, rows) => {
            if (getErr || !rows?.length) {
              return res.status(201).json({
                success: true,
                question: {
                  id: questionId,
                  text: String(text).trim(),
                  audience,
                  studentLevel: levelVal,
                  section: section || "scoring",
                  category: category || "Other",
                  evaluationType,
                  required: required !== false,
                  isActive: Boolean(isActive),
                  status: statusVal,
                  order: sortOrder,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              });
            }
            return res.status(201).json({ success: true, question: mapRow(rows[0]) });
          });
        },
      );
    };

    if (typeof order === "number") {
      insert(order);
      return;
    }

    db.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM survey_questions WHERE audience = ?`,
      [audience],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Database error.", error: err.message });
        }
        const nextOrder = (rows?.[0]?.max_order ?? -1) + 1;
        insert(nextOrder);
      },
    );
  });
};

// PUT /api/survey-questions/:id
const updateQuestion = (req, res) => {
  const { id } = req.params;
  const {
    text,
    audience,
    section,
    category,
    evaluationType,
    required,
    isActive,
    status,
    order,
  } = req.body || {};

  if (!id) {
    return res.status(400).json({ success: false, message: "Question id is required." });
  }

  db.query(`SELECT * FROM survey_questions WHERE id = ?`, [id], (findErr, rows) => {
    if (findErr) {
      return res.status(500).json({ success: false, message: "Database error.", error: findErr.message });
    }
    if (!rows?.length) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    const current = rows[0];
    const next = {
      text: text !== undefined ? String(text).trim() : current.text,
      audience: audience && VALID_AUDIENCES.has(audience) ? audience : current.audience,
      section: section !== undefined ? section : current.section,
      category: category !== undefined ? category : current.category,
      evaluation_type:
        evaluationType && VALID_TYPES.has(evaluationType) ? evaluationType : current.evaluation_type,
      required: required === undefined ? current.required : required ? 1 : 0,
      is_active: isActive === undefined ? current.is_active : isActive ? 1 : 0,
      status: status && VALID_STATUS.has(status) ? status : current.status,
      sort_order: typeof order === "number" ? order : current.sort_order,
    };

    if (!next.text) {
      return res.status(400).json({ success: false, message: "Question text is required." });
    }

    db.query(
      `UPDATE survey_questions
       SET text=?, audience=?, section=?, category=?, evaluation_type=?, required=?, is_active=?, status=?, sort_order=?
       WHERE id=?`,
      [
        next.text,
        next.audience,
        next.section,
        next.category,
        next.evaluation_type,
        next.required,
        next.is_active,
        next.status,
        next.sort_order,
        id,
      ],
      (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Failed to update question.", error: err.message });
        }
        db.query(`SELECT * FROM survey_questions WHERE id = ?`, [id], (getErr, updated) => {
          if (getErr || !updated?.length) {
            return res.status(200).json({ success: true, message: "Question updated." });
          }
          return res.status(200).json({ success: true, question: mapRow(updated[0]) });
        });
      },
    );
  });
};

// DELETE /api/survey-questions/:id
const deleteQuestion = (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM survey_questions WHERE id = ?`, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }
    return res.status(200).json({ success: true, message: "Question deleted." });
  });
};

// POST /api/survey-questions/reorder  body: { orderedIds: string[] }
const reorderQuestions = (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
  if (orderedIds.length === 0) {
    return res.status(400).json({ success: false, message: "orderedIds is required." });
  }

  // Update sequentially; simple + reliable for admin tool usage
  let pending = orderedIds.length;
  let failed = false;

  orderedIds.forEach((qid, index) => {
    db.query(
      `UPDATE survey_questions SET sort_order = ? WHERE id = ?`,
      [index, qid],
      (err) => {
        if (failed) return;
        if (err) {
          failed = true;
          return res.status(500).json({ success: false, message: "Failed to reorder questions.", error: err.message });
        }
        pending -= 1;
        if (pending === 0) {
          return res.status(200).json({ success: true, message: "Questions reordered." });
        }
      },
    );
  });
};

// POST /api/survey-questions/bulk-status  body: { audience, studentLevel, status, isActive }
const bulkStatus = (req, res) => {
  const { audience, studentLevel, status, isActive } = req.body || {};
  if (!VALID_AUDIENCES.has(audience)) {
    return res.status(400).json({ success: false, message: "Invalid audience." });
  }

  const statusVal = status && VALID_STATUS.has(status) ? status : isActive ? "published" : "draft";
  const activeVal = isActive === undefined ? (statusVal === "published" ? 1 : 0) : isActive ? 1 : 0;
  const levelVal = studentLevel && VALID_LEVELS.has(studentLevel) ? studentLevel : null;

  const sql = levelVal
    ? `UPDATE survey_questions SET status = ?, is_active = ? WHERE audience = ? AND student_level = ?`
    : `UPDATE survey_questions SET status = ?, is_active = ? WHERE audience = ?`;
  const params = levelVal
    ? [statusVal, activeVal, audience, levelVal]
    : [statusVal, activeVal, audience];

  db.query(sql, params, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to update status.", error: err.message });
    }
    return res.status(200).json({
      success: true,
      message: "Status updated.",
      affected: result.affectedRows,
    });
  });
};

// POST /api/survey-questions/bulk  body: { questions: [...] }  — for CSV import / migration
const bulkCreate = (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({ success: false, message: "Database error.", error: tableErr.message });
    }

    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (questions.length === 0) {
      return res.status(400).json({ success: false, message: "No questions provided." });
    }

    let done = 0;
    let failed = false;
    const inserted = [];

    questions.forEach((q, index) => {
      if (failed) return;
      const questionId = q.id || crypto.randomUUID();
      const audience = VALID_AUDIENCES.has(q.audience) ? q.audience : "student";
      const evaluation_type = VALID_TYPES.has(q.evaluationType) ? q.evaluationType : "rating";
      const statusVal = VALID_STATUS.has(q.status) ? q.status : "draft";
      const sortOrder = typeof q.order === "number" ? q.order : index;

      db.query(
        `INSERT INTO survey_questions
          (id, text, audience, section, category, evaluation_type, required, is_active, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           text=VALUES(text),
           audience=VALUES(audience),
           section=VALUES(section),
           category=VALUES(category),
           evaluation_type=VALUES(evaluation_type),
           required=VALUES(required),
           is_active=VALUES(is_active),
           status=VALUES(status),
           sort_order=VALUES(sort_order)`,
        [
          questionId,
          String(q.text || "").trim(),
          audience,
          q.section || "scoring",
          q.category || "Other",
          evaluation_type,
          q.required === false ? 0 : 1,
          q.isActive === false ? 0 : 1,
          statusVal,
          sortOrder,
        ],
        (err) => {
          if (failed) return;
          if (err) {
            failed = true;
            return res.status(500).json({ success: false, message: "Bulk import failed.", error: err.message });
          }
          inserted.push(questionId);
          done += 1;
          if (done === questions.length) {
            return res.status(201).json({ success: true, count: inserted.length, ids: inserted });
          }
        },
      );
    });
  });
};

module.exports = {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  bulkStatus,
  bulkCreate,
  ensureTable,
};
