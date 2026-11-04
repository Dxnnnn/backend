require('dotenv').config();
const db = require('./src/config/db');

db.query(
  "SELECT student_name, school_head_id, faculty_name FROM evaluation_submissions WHERE source = 'school_head'",
  (err, rows) => {
    if (err) { console.error(err.message); process.exit(1); }
    console.log('Submissions with school_head_id:');
    rows.forEach(r => console.log(JSON.stringify(r)));
    process.exit(0);
  }
);
