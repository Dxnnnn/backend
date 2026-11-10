require("dotenv").config({ path: "../../.env" });
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const admins = [
  {
    username: "superadmin",
    email: "admin@bc.edu.ph",
    password: "Admin@BC2026",
    full_name: "Super Administrator",
    role: "Super Admin",
    phone: null,
  },
];

async function seed() {
  console.log("Seeding admin accounts...");

  for (const admin of admins) {
    const hashedPassword = bcrypt.hashSync(admin.password, 12);

    const checkSql = "SELECT id FROM admins WHERE email = ?";
    db.query(checkSql, [admin.email], (err, results) => {
      if (err) {
        console.error("Error checking admin:", err.message);
        return;
      }

      if (results.length > 0) {
        console.log(`Admin "${admin.email}" already exists, skipping.`);
        return;
      }

      const insertSql = `
        INSERT INTO admins (username, email, password, full_name, role, phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [admin.username, admin.email, hashedPassword, admin.full_name, admin.role, admin.phone],
        (err, result) => {
          if (err) {
            console.error("Error inserting admin:", err.message);
            return;
          }
          console.log(`Admin "${admin.email}" created with id ${result.insertId}`);
        }
      );
    });
  }

  setTimeout(() => {
    db.end();
    console.log("Seeding complete.");
  }, 2000);
}

seed();
