const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "bc_eval_jwt_secret_2026_benedicto_college";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// ===========================
// LOGIN ADMIN
// ===========================
const loginAdmin = (req, res) => {
  const { email, password, username } = req.body;
  const identifier = email || username;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  const sql = "SELECT * FROM admins WHERE email = ? OR username = ?";

  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const admin = results[0];
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // Block deactivated accounts from logging in
    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact the Super Admin." });
    }

    const adminSubRole = admin.role ?? "Data Center";

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: "admin", admin_role: adminSubRole },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: "admin",
        admin_role: adminSubRole, // from DB: "Executive Office" | "Data Center"
      },
    });
  });
};

// ===========================
// REGISTER ADMIN
// ===========================
const registerAdmin = (req, res) => {
  const { username, email, password, fullname, phone } = req.body;

  if (!email || !password || (!username && !fullname)) {
    return res.status(400).json({ success: false, message: "Fullname (or username), email, and password are required." });
  }

  const adminUsername = username || fullname;
  const adminFullName = fullname || username;
  const checkSql = "SELECT id FROM admins WHERE email = ? OR username = ?";

  db.query(checkSql, [email, adminUsername], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error.", error: err.message });
    }

    if (results.length > 0) {
      return res.status(409).json({ success: false, message: "Username or email already exists." });
    }

    const hashedPassword = bcrypt.hashSync(password, 12);
    const insertSql = `INSERT INTO admins (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)`;

    db.query(insertSql, [adminUsername, email, hashedPassword, adminFullName, phone || null], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to create admin.", error: err.message });
      }

      return res.status(201).json({ success: true, message: "Admin registered successfully.", adminId: result.insertId });
    });
  });
};

module.exports = { loginAdmin, registerAdmin };
