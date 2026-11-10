const db = require("../config/db");

// All valid permission keys in the system
const ALL_PERMISSIONS = [
  "dashboard",
  "accounts.student",
  "accounts.school_head",
  "faculty",
  "questionnaire.student",
  "questionnaire.school_head",
  "evaluation_status.student",
  "evaluation_status.school_head",
  "semester",
  "subjects",
  "reports.student",
  "reports.school_head",
];

// GET /api/admins/:id/permissions
const getPermissions = (req, res) => {
  const { id } = req.params;
  db.query(
    "SELECT permission, granted FROM admin_permissions WHERE admin_id = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      // Return a map: { permission_key: true/false }
      const map = {};
      for (const row of rows) {
        map[row.permission] = row.granted === 1;
      }
      return res.status(200).json({ success: true, permissions: map });
    }
  );
};

// PUT /api/admins/:id/permissions  — replace all permissions for an admin
const setPermissions = (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body ?? {}; // { [key]: boolean }

  if (!permissions || typeof permissions !== "object") {
    return res.status(400).json({ success: false, message: "permissions object is required." });
  }

  // Build UPSERT rows only for known keys
  const rows = [];
  for (const key of ALL_PERMISSIONS) {
    const granted = permissions[key] === true ? 1 : 0;
    rows.push([id, key, granted]);
  }

  // Use INSERT ... ON DUPLICATE KEY UPDATE for atomic upsert
  const sql = `
    INSERT INTO admin_permissions (admin_id, permission, granted)
    VALUES ?
    ON DUPLICATE KEY UPDATE granted = VALUES(granted), updated_at = CURRENT_TIMESTAMP
  `;

  db.query(sql, [rows], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    return res.status(200).json({ success: true, message: "Permissions saved." });
  });
};

module.exports = { getPermissions, setPermissions, ALL_PERMISSIONS };
