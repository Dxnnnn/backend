const bcrypt = require("bcryptjs");
const db = require("../config/db");

// GET /api/admins — list all admin staff (excludes the super admin seeded account)
const getAllAdmins = (req, res) => {
  const superAdminId = req.user?.id; // Current logged-in admin is the super admin
  db.query(
    `SELECT id, username, email, full_name, is_active, created_at FROM admins WHERE id != ? ORDER BY created_at ASC`,
    [superAdminId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      return res.status(200).json({ success: true, admins: results });
    }
  );
};

// POST /api/admins — create a new admin
const createAdmin = (req, res) => {
  const { full_name, email, password } = req.body ?? {};

  if (!full_name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ success: false, message: "Full name, email, and password are required." });
  }

  // Use full_name as username (slugified)
  const username = full_name.trim().toLowerCase().replace(/\s+/g, ".");

  db.query("SELECT id FROM admins WHERE email = ? OR username = ?", [email.trim(), username], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: "Email or username already exists." });

    const hashedPassword = bcrypt.hashSync(password, 12);
    db.query(
      `INSERT INTO admins (username, email, password, full_name) VALUES (?, ?, ?, ?)`,
      [username, email.trim(), hashedPassword, full_name.trim()],
      (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to create admin.", error: err.message });
        return res.status(201).json({
          success: true,
          message: "Admin created successfully.",
          admin: {
            id: result.insertId,
            username,
            email: email.trim(),
            full_name: full_name.trim(),
            is_active: 1,
            created_at: new Date().toISOString(),
          },
        });
      }
    );
  });
};

// PATCH /api/admins/:id/toggle — toggle active status
const toggleAdminStatus = (req, res) => {
  const { id } = req.params;
  db.query("UPDATE admins SET is_active = NOT is_active WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Admin not found." });
    return res.status(200).json({ success: true, message: "Admin status updated." });
  });
};

// DELETE /api/admins/:id — only admin staff can be deleted, not the super admin
const deleteAdmin = (req, res) => {
  const { id } = req.params;
  const superAdminId = req.user?.id;

  // Prevent deleting yourself or the super admin
  if (String(superAdminId) === String(id)) {
    return res.status(400).json({ success: false, message: "You cannot delete your own account." });
  }

  db.query("DELETE FROM admins WHERE id = ? AND id != ?", [id, superAdminId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Admin staff not found." });
    return res.status(200).json({ success: true, message: "Admin staff deleted." });
  });
};

// PUT /api/admins/me/password — change own password
const changePassword = (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const adminId = req.user?.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Current and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
  }

  db.query("SELECT password FROM admins WHERE id = ?", [adminId], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (!results.length) return res.status(404).json({ success: false, message: "Admin not found." });

    const isMatch = await bcrypt.compare(currentPassword, results[0].password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect." });

    const hashed = bcrypt.hashSync(newPassword, 12);
    db.query("UPDATE admins SET password = ? WHERE id = ?", [hashed, adminId], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Failed to update password.", error: err2.message });
      return res.status(200).json({ success: true, message: "Password updated successfully." });
    });
  });
};

module.exports = { getAllAdmins, createAdmin, toggleAdminStatus, deleteAdmin, changePassword };
