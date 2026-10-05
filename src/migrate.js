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

// ── Safe column alterations ────────────────────────────────────────────────
// These run after CREATE TABLE IF NOT EXISTS so existing production DBs get
// the schema updates without dropping any data.
// Each statement is wrapped in a stored procedure that checks the information
// schema first, making them safe to run on every deploy (idempotent).
const alterSql = `
-- 1. Widen faculty.department from VARCHAR(150) to TEXT
DROP PROCEDURE IF EXISTS alter_faculty_department;
CREATE PROCEDURE alter_faculty_department()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'faculty'
      AND COLUMN_NAME  = 'department'
      AND DATA_TYPE    = 'varchar'
  ) THEN
    ALTER TABLE \`faculty\` MODIFY COLUMN \`department\` TEXT NOT NULL;
  END IF;
END;
CALL alter_faculty_department();
DROP PROCEDURE IF EXISTS alter_faculty_department;

-- 2. Widen faculty.semester from VARCHAR(50) to TEXT
DROP PROCEDURE IF EXISTS alter_faculty_semester;
CREATE PROCEDURE alter_faculty_semester()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'faculty'
      AND COLUMN_NAME  = 'semester'
      AND DATA_TYPE    = 'varchar'
  ) THEN
    ALTER TABLE \`faculty\` MODIFY COLUMN \`semester\` TEXT DEFAULT NULL;
  END IF;
END;
CALL alter_faculty_semester();
DROP PROCEDURE IF EXISTS alter_faculty_semester;

-- 3. Add faculty.profile_image if it does not exist
DROP PROCEDURE IF EXISTS alter_faculty_profile_image;
CREATE PROCEDURE alter_faculty_profile_image()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'faculty'
      AND COLUMN_NAME  = 'profile_image'
  ) THEN
    ALTER TABLE \`faculty\` ADD COLUMN \`profile_image\` TEXT DEFAULT NULL;
  END IF;
END;
CALL alter_faculty_profile_image();
DROP PROCEDURE IF EXISTS alter_faculty_profile_image;
`;

// ── Foreign Key alterations ────────────────────────────────────────────────
// Idempotent — each step checks information_schema before acting.
const fkSql = `
-- 1. Convert evaluation_submissions.faculty_id from VARCHAR(50) to INT
--    (required to match faculty.id which is INT)
DROP PROCEDURE IF EXISTS fk_fix_faculty_id_type;
CREATE PROCEDURE fk_fix_faculty_id_type()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'evaluation_submissions'
      AND COLUMN_NAME  = 'faculty_id'
      AND DATA_TYPE    = 'varchar'
  ) THEN
    -- Delete any orphaned rows first to avoid FK violation
    DELETE es FROM evaluation_submissions es
    LEFT JOIN faculty f ON CAST(es.faculty_id AS UNSIGNED) = f.id
    WHERE f.id IS NULL;

    ALTER TABLE \`evaluation_submissions\`
      MODIFY COLUMN \`faculty_id\` INT NOT NULL;
  END IF;
END;
CALL fk_fix_faculty_id_type();
DROP PROCEDURE IF EXISTS fk_fix_faculty_id_type;

-- 2. Add FK: evaluation_submissions.faculty_id → faculty.id (CASCADE)
DROP PROCEDURE IF EXISTS fk_add_submission_faculty;
CREATE PROCEDURE fk_add_submission_faculty()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA    = DATABASE()
      AND TABLE_NAME      = 'evaluation_submissions'
      AND CONSTRAINT_NAME = 'fk_submission_faculty'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE \`evaluation_submissions\`
      ADD CONSTRAINT \`fk_submission_faculty\`
      FOREIGN KEY (\`faculty_id\`) REFERENCES \`faculty\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END;
CALL fk_add_submission_faculty();
DROP PROCEDURE IF EXISTS fk_add_submission_faculty;

-- 3. Add FK: evaluation_submissions.student_id → students.student_id (SET NULL)
DROP PROCEDURE IF EXISTS fk_add_submission_student;
CREATE PROCEDURE fk_add_submission_student()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA    = DATABASE()
      AND TABLE_NAME      = 'evaluation_submissions'
      AND CONSTRAINT_NAME = 'fk_submission_student'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE \`evaluation_submissions\`
      ADD CONSTRAINT \`fk_submission_student\`
      FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`student_id\`)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END;
CALL fk_add_submission_student();
DROP PROCEDURE IF EXISTS fk_add_submission_student;

-- 4. Add semester_id column to evaluation_submissions if it does not exist
DROP PROCEDURE IF EXISTS fk_add_semester_id_col;
CREATE PROCEDURE fk_add_semester_id_col()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'evaluation_submissions'
      AND COLUMN_NAME  = 'semester_id'
  ) THEN
    ALTER TABLE \`evaluation_submissions\`
      ADD COLUMN \`semester_id\` VARCHAR(36) DEFAULT NULL;
  END IF;
END;
CALL fk_add_semester_id_col();
DROP PROCEDURE IF EXISTS fk_add_semester_id_col;

-- 5. Add FK: evaluation_submissions.semester_id → semesters.id (SET NULL)
DROP PROCEDURE IF EXISTS fk_add_submission_semester;
CREATE PROCEDURE fk_add_submission_semester()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA    = DATABASE()
      AND TABLE_NAME      = 'evaluation_submissions'
      AND CONSTRAINT_NAME = 'fk_submission_semester'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE \`evaluation_submissions\`
      ADD CONSTRAINT \`fk_submission_semester\`
      FOREIGN KEY (\`semester_id\`) REFERENCES \`semesters\`(\`id\`)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END;
CALL fk_add_submission_semester();
DROP PROCEDURE IF EXISTS fk_add_submission_semester;

-- 6. Add school_head_id column to evaluation_submissions if it does not exist
DROP PROCEDURE IF EXISTS fk_add_school_head_id_col;
CREATE PROCEDURE fk_add_school_head_id_col()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'evaluation_submissions'
      AND COLUMN_NAME  = 'school_head_id'
  ) THEN
    ALTER TABLE \`evaluation_submissions\`
      ADD COLUMN \`school_head_id\` INT DEFAULT NULL;
  END IF;
END;
CALL fk_add_school_head_id_col();
DROP PROCEDURE IF EXISTS fk_add_school_head_id_col;

-- 7. Add FK: evaluation_submissions.school_head_id → school_heads.id (SET NULL)
DROP PROCEDURE IF EXISTS fk_add_submission_school_head;
CREATE PROCEDURE fk_add_submission_school_head()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA    = DATABASE()
      AND TABLE_NAME      = 'evaluation_submissions'
      AND CONSTRAINT_NAME = 'fk_submission_school_head'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE \`evaluation_submissions\`
      ADD CONSTRAINT \`fk_submission_school_head\`
      FOREIGN KEY (\`school_head_id\`) REFERENCES \`school_heads\`(\`id\`)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END;
CALL fk_add_submission_school_head();
DROP PROCEDURE IF EXISTS fk_add_submission_school_head;
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
    console.log("Tables created/verified. Running schema alterations...");
    db.query(alterSql, (err2) => {
      if (err2) {
        console.error("Alteration failed:", err2.message);
        process.exit(1);
      }
      console.log("Schema alterations done. Applying foreign keys...");
      db.query(fkSql, (err3) => {
        if (err3) {
          console.error("Foreign key migration failed:", err3.message);
          process.exit(1);
        }
        console.log("Migration completed successfully.");
        db.end();
        process.exit(0);
      });
    });
  });
});
