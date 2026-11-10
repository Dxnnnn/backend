const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "bc_eval_jwt_secret_2026_benedicto_college";

/**
 * Middleware — verifies the Bearer JWT in the Authorization header.
 * Attaches decoded payload to req.user on success.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired. Please log in again." });
    }
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
}

/**
 * Role-based guard factory.
 * Usage: requireRole("admin")  or  requireRole("admin", "faculty")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden. Insufficient permissions." });
    }
    return next();
  };
}

/**
 * Admin sub-role guard factory.
 * Checks req.user.admin_role (set from JWT payload).
 * Usage: requireAdminSubRole("Executive Office")
 *        requireAdminSubRole("Data Center")
 *        requireAdminSubRole("Executive Office", "Data Center")  — allow both
 */
function requireAdminSubRole(...subRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }
    if (!subRoles.includes(req.user.admin_role)) {
      return res.status(403).json({ success: false, message: "Forbidden. Your role does not have permission for this action." });
    }
    return next();
  };
}

/**
 * Granular permission guard factory.
 * Checks that the authenticated admin has the given permission key granted
 * in the admin_permissions table.
 *
 * Super Admin (role === "Super Admin") bypasses all permission checks.
 *
 * Usage:
 *   router.get("/", verifyToken, requireRole("admin"), requirePermission("accounts.student"), handler)
 */
function requirePermission(permissionKey) {
  const db = require("../config/db");
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }
    // Super Admin always has access
    if (req.user.admin_role === "Super Admin") {
      return next();
    }
    db.query(
      "SELECT granted FROM admin_permissions WHERE admin_id = ? AND permission = ?",
      [req.user.id, permissionKey],
      (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (!rows.length || rows[0].granted !== 1) {
          return res.status(403).json({ success: false, message: "Forbidden. You do not have permission for this module." });
        }
        return next();
      }
    );
  };
}

module.exports = { verifyToken, requireRole, requireAdminSubRole, requirePermission };
