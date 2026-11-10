const bcrypt = require("bcryptjs");
const db = require("../config/db");

// GET /api/admins — list all admin staff (excludes the super admin seeded account)
const getAllAdmins = (req, res) => {
  const superAdminId = req.user?.id;
  db.query(
    `SELECT id, username, email, full_name, role, is_active, created_at FROM admins WHERE id != ? ORDER BY created_at ASC`,
    [superAdminId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
      return res.status(200).json({ success: true, admins: results });
    }
  );
};

// POST /api/admins — create a new admin
const createAdmin = (req, res) => {
  const { full_name, email, password, role } = req.body ?? {};

  if (!full_name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ success: false, message: "Full name, email, and password are required." });
  }

  // Only EO and Data Center can be created; Super Admin is reserved for seeded account
  const validRoles = ["Executive Office", "Data Center"];
  const adminRole = validRoles.includes(role) ? role : "Data Center";

  const username = full_name.trim().toLowerCase().replace(/\s+/g, ".");

  db.query("SELECT id FROM admins WHERE email = ? OR username = ?", [email.trim(), username], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: "Email or username already exists." });

    const hashedPassword = bcrypt.hashSync(password, 12);
    db.query(
      `INSERT INTO admins (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)`,
      [username, email.trim(), hashedPassword, full_name.trim(), adminRole],
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
            role: adminRole,
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

// PUT /api/admins/me/password — change own password (no current password required)
const changePassword = (req, res) => {
  const { newPassword } = req.body ?? {};
  const adminId = req.user?.id;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: "New password is required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
  }

  const hashed = bcrypt.hashSync(newPassword, 12);
  db.query("UPDATE admins SET password = ? WHERE id = ?", [hashed, adminId], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Failed to update password.", error: err.message });
    return res.status(200).json({ success: true, message: "Password updated successfully." });
  });
};

// PATCH /api/admins/:id/reset-password — Super Admin resets an EO/DC password
const resetAdminPassword = (req, res) => {
  const { id } = req.params;
  const superAdminId = req.user?.id;

  if (String(superAdminId) === String(id)) {
    return res.status(400).json({ success: false, message: "You cannot reset your own password this way." });
  }

  // Fetch the admin's name to build a readable temp password
  db.query("SELECT full_name, role FROM admins WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    if (!rows.length) return res.status(404).json({ success: false, message: "Admin not found." });

    const { role } = rows[0];
    const validRoles = ["Executive Office", "Data Center"];
    if (!validRoles.includes(role)) {
      return res.status(403).json({ success: false, message: "Can only reset EO or DC passwords." });
    }

    // Generate a temp password: BC@ + role prefix + 4-digit random
    const prefix = role === "Executive Office" ? "eo" : "dc";
    const rand = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `BC@${prefix}${rand}`;
    const hashed = bcrypt.hashSync(tempPassword, 12);

    db.query("UPDATE admins SET password = ? WHERE id = ?", [hashed, id], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Failed to reset password.", error: err2.message });
      return res.status(200).json({ success: true, generatedPassword: tempPassword });
    });
  });
};

module.exports = { getAllAdmins, createAdmin, toggleAdminStatus, deleteAdmin, changePassword, resetAdminPassword };
