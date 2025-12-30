#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

async function main() {
  const {
    DB_HOST = 'localhost',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'fullstack_test_portal',
  } = process.env;

  const pool = await mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  // Ensure ledger table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applied_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const [appliedRows] = await pool.query('SELECT name FROM applied_migrations');
  const applied = new Set(appliedRows.map(r => r.name));

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    await pool.query('INSERT INTO applied_migrations (name) VALUES (?)', [file]);
  }

  await pool.end();
  console.log('Migrations completed');
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
