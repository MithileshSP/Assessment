const { pool } = require('./database/connection');

async function runMigration() {
    console.log('Starting manual js-driven migration...');

    try {
        const mysql = require('mysql2/promise');
        require('dotenv').config({ path: require('path').join(__dirname, '.env') });

        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'portal_mysql',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log("Connected! Running precise migration steps...");

        // 1. Ensure submission_assignments exists
        await conn.query(`
      CREATE TABLE IF NOT EXISTS submission_assignments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          submission_id VARCHAR(100) NOT NULL,
          faculty_id VARCHAR(100) NOT NULL,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'pending',
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
          FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_submission_assignment (submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // Helper to safely add column
        async function addCol(table, col, def) {
            try {
                await conn.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
                console.log(`Added column ${col} to ${table}`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') console.log(`Column ${col} already exists in ${table}, skipping.`);
                else throw e;
            }
        }

        // Helper to safely add index
        async function addIdx(table, idxName, idxDef) {
            try {
                await conn.query(`ALTER TABLE ${table} ADD INDEX ${idxName} ${idxDef}`);
                console.log(`Added index ${idxName} to ${table}`);
            } catch (e) {
                if (e.code === 'ER_DUP_KEYNAME') console.log(`Index ${idxName} already exists on ${table}, skipping.`);
                else throw e;
            }
        }

        // 2. Modify status safely
        try { await conn.query("ALTER TABLE submission_assignments MODIFY COLUMN status VARCHAR(50);"); } catch (e) { }
        await conn.query("UPDATE submission_assignments SET status = 'assigned' WHERE status = 'pending'");
        try { await conn.query("ALTER TABLE submission_assignments MODIFY COLUMN status ENUM('unassigned','assigned','in_progress','evaluated','reallocated','reopened') DEFAULT 'assigned'"); } catch (e) { }

        // 3. Add columns
        await addCol('submission_assignments', 'version', 'INT NOT NULL DEFAULT 1');
        await addCol('submission_assignments', 'locked_by', 'VARCHAR(100) NULL');
        await addCol('submission_assignments', 'locked_at', 'TIMESTAMP NULL');
        await addCol('submission_assignments', 'reallocation_count', 'INT NOT NULL DEFAULT 0');
        await addCol('submission_assignments', 'last_reallocated_at', 'TIMESTAMP NULL');
        await addCol('submission_assignments', 'submission_weight', 'INT NOT NULL DEFAULT 1');

        // 4. Add Indexes
        await addIdx('submission_assignments', 'idx_sa_status', '(status)');
        await addIdx('submission_assignments', 'idx_sa_faculty_status', '(faculty_id, status)');
        await addIdx('submission_assignments', 'idx_sa_faculty', '(faculty_id)');

        // 5. Extend Users
        await addCol('users', 'is_available', 'BOOLEAN DEFAULT TRUE');
        await addCol('users', 'max_capacity', 'INT DEFAULT 10');
        await addCol('users', 'current_load', 'INT DEFAULT 0');

        // 6. Assignment Logs
        await conn.query(`
      CREATE TABLE IF NOT EXISTS assignment_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        from_faculty_id VARCHAR(100) NULL,
        to_faculty_id VARCHAR(100) NULL,
        admin_id VARCHAR(100) NULL,
        actor_role VARCHAR(20) DEFAULT 'system',
        notes TEXT,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (from_faculty_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (to_faculty_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_al_submission (submission_id),
        INDEX idx_al_action (action_type),
        INDEX idx_al_created (created_at),
        INDEX idx_al_faculty (to_faculty_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        // 7. Submissions
        await addCol('submissions', 'exported_at', 'TIMESTAMP NULL');

        console.log("Migration executed successfully!");
        conn.destroy();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
