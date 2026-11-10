require('dotenv').config();
const db = require('./src/config/db');

const queries = [
  // Add Data Center back to enum (Super Admin, Executive Office, Data Center)
  `ALTER TABLE admins MODIFY COLUMN role ENUM('Super Admin','Executive Office','Data Center') NOT NULL DEFAULT 'Data Center'`,
];

(async () => {
  for (let i = 0; i < queries.length; i++) {
    await new Promise((resolve) => {
      db.query(queries[i], (err) => {
        if (err) console.error(`Step ${i + 1} FAILED:`, err.message);
        else console.log(`Step ${i + 1} OK`);
        resolve();
      });
    });
  }
  
  console.log('\n=== VERIFICATION ===');
  db.query('SELECT id, username, full_name, role FROM admins ORDER BY id', (err, results) => {
    if (err) console.error(err.message);
    else console.table(results);
    process.exit(0);
  });
})();
