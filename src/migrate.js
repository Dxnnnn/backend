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
CREATE TABLE IF NOT EXISTS \`admins\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`username\` varchar(100) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`password\` varchar(255) NOT NULL,
  \`full_name\` varchar(150) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`last_login\` datetime DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`username\` (\`username\`),
  UNIQUE KEY \`email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO \`admins\` VALUES (2,'admin@bc.com','admin@example.com','$2b$12$SozPLBiMbL3aqD6UW/VUzeyYeP.NCNzpfiShDmpxAodvHYoDzQSEW','Administrator','09123456789',1,NULL,'2026-07-19 15:58:15','2026-07-19 15:58:15');

CREATE TABLE IF NOT EXISTS \`school_heads\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`id_number\` varchar(100) NOT NULL,
  \`full_name\` varchar(150) NOT NULL,
  \`department\` varchar(150) NOT NULL,
  \`password\` varchar(255) NOT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id_number\` (\`id_number\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`faculty\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(150) NOT NULL,
  \`email\` varchar(255) DEFAULT NULL,
  \`position\` varchar(100) DEFAULT NULL,
  \`department\` varchar(150) NOT NULL,
  \`subjects\` text DEFAULT NULL,
  \`semester\` varchar(50) DEFAULT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`students\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`student_id\` varchar(100) NOT NULL,
  \`first_name\` varchar(100) NOT NULL,
  \`last_name\` varchar(100) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`password\` varchar(255) NOT NULL,
  \`student_level\` enum('elementary','junior-high','senior-high','college') NOT NULL,
  \`grade\` varchar(20) DEFAULT NULL,
  \`year_level\` varchar(50) DEFAULT NULL,
  \`section\` varchar(10) DEFAULT NULL,
  \`strand\` varchar(50) DEFAULT NULL,
  \`course\` varchar(50) DEFAULT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`student_id\` (\`student_id\`),
  UNIQUE KEY \`email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`evaluation_submissions\` (
  \`id\` varchar(36) NOT NULL,
  \`student_id\` varchar(100) DEFAULT NULL,
  \`student_name\` varchar(200) DEFAULT NULL,
  \`faculty_id\` varchar(50) NOT NULL,
  \`faculty_name\` varchar(150) NOT NULL,
  \`department\` varchar(150) NOT NULL,
  \`subject\` varchar(200) NOT NULL,
  \`semester\` varchar(50) DEFAULT NULL,
  \`remarks\` text DEFAULT NULL,
  \`scoring_answers\` json NOT NULL,
  \`personal_answers\` json NOT NULL,
  \`source\` ENUM('student','school_head') NOT NULL DEFAULT 'student',
  \`submitted_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`semesters\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`school_year\` VARCHAR(20) NOT NULL,
  \`term\` ENUM('1st Semester','2nd Semester','Summer') NOT NULL,
  \`subjects\` TEXT NOT NULL,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT '1',
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_year_term\` (\`school_year\`, \`term\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`survey_questions\` (
  \`id\` varchar(36) NOT NULL,
  \`text\` text NOT NULL,
  \`audience\` enum('student','school_head') NOT NULL DEFAULT 'student',
  \`section\` varchar(50) NOT NULL DEFAULT 'scoring',
  \`category\` varchar(100) NOT NULL DEFAULT 'Other',
  \`evaluation_type\` enum('rating','essay','yes_no') NOT NULL DEFAULT 'rating',
  \`required\` tinyint(1) NOT NULL DEFAULT '1',
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`status\` enum('published','draft') NOT NULL DEFAULT 'draft',
  \`sort_order\` int NOT NULL DEFAULT '0',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_audience\` (\`audience\`),
  KEY \`idx_active\` (\`is_active\`),
  KEY \`idx_order\` (\`sort_order\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

db.connect((err) => {
  if (err) {
    console.error("Migration failed - connection error:", err.message);
    process.exit(1);
  }
  console.log("Connected to MySQL. Running migrations...");
  db.query(sql, (err) => {
    if (err) {
      console.error("Migration failed:", err.message);
      process.exit(1);
    }
    console.log("Migration completed successfully.");
    db.end();
    process.exit(0);
  });
});
