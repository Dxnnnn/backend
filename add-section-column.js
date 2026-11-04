/**
 * Add section column to subjects table
 * Usage: node add-section-column.js
 */

require("dotenv").config();
const db = require("./src/config/db");

console.log("Adding section column to subjects table...\n");

// First check if column exists
const checkSql = `
  SELECT COUNT(*) as count 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'subjects' 
  AND COLUMN_NAME = 'section'
`;

db.query(checkSql, (err, results) => {
  if (err) {
    console.error("✗ Error checking column:", err.message);
    process.exit(1);
  }

  const columnExists = results[0].count > 0;

  if (columnExists) {
    console.log("✓ Section column already exists!");
    process.exit(0);
  } else {
    // Add the column
    const addSql = `ALTER TABLE subjects ADD COLUMN section varchar(50) DEFAULT NULL AFTER strand`;
    
    db.query(addSql, (err2) => {
      if (err2) {
        console.error("✗ Error adding column:", err2.message);
        process.exit(1);
      } else {
        console.log("✓ Section column added successfully!");
        
        // Add index
        const indexSql = `CREATE INDEX idx_section ON subjects(section)`;
        db.query(indexSql, (err3) => {
          if (err3 && !err3.message.includes("Duplicate key")) {
            console.warn("Warning: Could not add index:", err3.message);
          } else {
            console.log("✓ Index added successfully!");
          }
          process.exit(0);
        });
      }
    });
  }
});
