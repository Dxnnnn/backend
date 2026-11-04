require("dotenv").config();
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  multipleStatements: true,
});

const sql = `
  ALTER TABLE \`faculty\`
    MODIFY COLUMN \`department\` TEXT NOT NULL,
    MODIFY COLUMN \`semester\` TEXT DEFAULT NULL;

  ALTER TABLE \`faculty\`
    ADD COLUMN IF NOT EXISTS \`profile_image\` TEXT DEFAULT NULL;
`;

db.connect((err) => {
  if (err) {
    console.error("Alter failed - connection error:", err.message);
    process.exit(1);
  }
  console.log("Connected. Running alter...");
  db.query(sql, (err) => {
    if (err) {
      console.error("Alter failed:", err.message);
      process.exit(1);
    }
    console.log("Alter completed: faculty table updated.");
    db.end();
    process.exit(0);
  });
});
