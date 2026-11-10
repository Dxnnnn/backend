const express = require("express");
const router = express.Router();
const { getSubjects, createSubject, updateSubject, deleteSubject } = require("../controller/subjectController");
const { verifyToken, requireRole, requireAdminSubRole, requirePermission } = require("../middleware/verifyToken");
const db = require("../config/db");

// Public
router.get("/", getSubjects);

// Protected — EO or DC with "subjects" permission
router.post("/", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("subjects"), createSubject);
router.put("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("subjects"), updateSubject);
router.delete("/:id", verifyToken, requireRole("admin"), requireAdminSubRole("Executive Office", "Data Center"), requirePermission("subjects"), deleteSubject);

/**
 * PATCH /api/subjects/:id/assign-teacher
 * Assigns a faculty member to a subject by updating faculty_id + faculty_name.
 * Allowed for both admins (EO/DC) AND school heads (faculty role).
 * After assignment also syncs faculty.subjects column.
 */
router.patch("/:id/assign-teacher", verifyToken, (req, res) => {
  const { id } = req.params;
  const { facultyId, facultyName } = req.body ?? {};

  if (!facultyId || !facultyName) {
    return res.status(400).json({ success: false, message: "facultyId and facultyName are required." });
  }

  db.query(
    `UPDATE subjects SET faculty_id = ?, faculty_name = ? WHERE id = ?`,
    [facultyId, facultyName, id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Subject not found." });

      // Sync faculty.subjects column
      db.query(
        `SELECT name FROM subjects WHERE faculty_id = ? ORDER BY name ASC`,
        [facultyId],
        (err2, rows) => {
          if (err2) return res.status(200).json({ success: true, message: "Teacher assigned." });
          const subjectsStr = (rows ?? []).map((r) => r.name).join(",");
          db.query(
            `UPDATE faculty SET subjects = ? WHERE id = ?`,
            [subjectsStr || null, facultyId],
            () => res.status(200).json({ success: true, message: "Teacher assigned and subjects synced." })
          );
        }
      );
    }
  );
});

/**
 * PATCH /api/subjects/assign-teacher-by-name
 * Assigns a faculty member to subject rows matching a given name.
 * Only updates rows that currently have no teacher assigned (faculty_id IS NULL).
 * This prevents overwriting an existing teacher assignment.
 */
router.patch("/assign-teacher-by-name", verifyToken, (req, res) => {
  const { subjectName, facultyId, facultyName, department } = req.body ?? {};

  if (!subjectName || !facultyId || !facultyName) {
    return res.status(400).json({ success: false, message: "subjectName, facultyId, and facultyName are required." });
  }

  // Only update rows where no teacher is currently assigned
  let sql = `UPDATE subjects SET faculty_id = ?, faculty_name = ? WHERE name = ? AND (faculty_id IS NULL OR faculty_id = ?)`;
  const params = [facultyId, facultyName, subjectName, facultyId];

  if (department) {
    sql += ` AND department = ?`;
    params.push(department);
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });

    // If no unassigned rows found, insert a new subject row for this teacher
    if (result.affectedRows === 0) {
      // Get an existing row to copy metadata (grade, section, etc.)
      let findSql = `SELECT * FROM subjects WHERE name = ?`;
      const findParams = [subjectName];
      if (department) { findSql += ` AND department = ?`; findParams.push(department); }
      findSql += ` LIMIT 1`;

      db.query(findSql, findParams, (err2, rows) => {
        if (err2 || !rows.length) {
          return res.status(200).json({ success: true, message: "No unassigned subject rows found.", updated: 0 });
        }
        const ref = rows[0];
        db.query(
          `INSERT INTO subjects (name, department, year_level, course, grade, strand, section, room_no, schedule_day, schedule_time, faculty_id, faculty_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ref.name, ref.department, ref.year_level, ref.course, ref.grade, ref.strand, ref.section, ref.room_no, ref.schedule_day, ref.schedule_time, facultyId, facultyName],
          (err3) => {
            if (err3) return res.status(500).json({ success: false, message: "Failed to create subject row.", error: err3.message });
            // Sync faculty.subjects
            db.query(`SELECT name FROM subjects WHERE faculty_id = ? ORDER BY name ASC`, [facultyId], (e, r) => {
              const subjectsStr = (r ?? []).map((x) => x.name).join(",");
              db.query(`UPDATE faculty SET subjects = ? WHERE id = ?`, [subjectsStr || null, facultyId],
                () => res.status(200).json({ success: true, message: "Teacher assigned to new subject row.", updated: 1 })
              );
            });
          }
        );
      });
      return;
    }

    // Sync faculty.subjects column for the assigned teacher
    db.query(
      `SELECT name FROM subjects WHERE faculty_id = ? ORDER BY name ASC`,
      [facultyId],
      (err2, rows) => {
        if (err2) return res.status(200).json({ success: true, message: "Teacher assigned.", updated: result.affectedRows });
        const subjectsStr = (rows ?? []).map((r) => r.name).join(",");
        db.query(
          `UPDATE faculty SET subjects = ? WHERE id = ?`,
          [subjectsStr || null, facultyId],
          () => res.status(200).json({ success: true, message: "Teacher assigned and subjects synced.", updated: result.affectedRows })
        );
      }
    );
  });
});

module.exports = router;
