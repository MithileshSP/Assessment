const { query } = require('./database/connection');

async function migrate() {
    console.log('🚀 Starting Global Session Migration...');
    try {
        // 1. Create global_test_sessions table
        console.log('Creating global_test_sessions table...');
        await query(`
      CREATE TABLE IF NOT EXISTS global_test_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        duration_minutes INT DEFAULT 60,
        is_active BOOLEAN DEFAULT TRUE,
        ended_reason ENUM('NORMAL','FORCED','TIMEOUT') DEFAULT 'NORMAL',
        forced_end BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(100),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        INDEX (course_id, level, is_active)
      )
    `);
        console.log('✅ global_test_sessions table created');

        // 2. Update test_attendance table
        console.log('Updating test_attendance table...');
        const columns = await query("SHOW COLUMNS FROM test_attendance");
        const fields = columns.map(c => c.Field);

        if (!fields.includes('session_id')) {
            await query("ALTER TABLE test_attendance ADD COLUMN session_id INT");
            console.log('✅ Added session_id to test_attendance');
        }
        if (!fields.includes('is_used')) {
            await query("ALTER TABLE test_attendance ADD COLUMN is_used BOOLEAN DEFAULT FALSE");
            console.log('✅ Added is_used to test_attendance');
        }
        if (!fields.includes('attempt_started_at')) {
            await query("ALTER TABLE test_attendance ADD COLUMN attempt_started_at TIMESTAMP NULL");
            console.log('✅ Added attempt_started_at to test_attendance');
        }
        if (!fields.includes('attempt_submitted_at')) {
            await query("ALTER TABLE test_attendance ADD COLUMN attempt_submitted_at TIMESTAMP NULL");
            console.log('✅ Added attempt_submitted_at to test_attendance');
        }

        // 3. Add Unique Constraint
        console.log('Adding session-scoped unique constraint...');
        try {
            await query("ALTER TABLE test_attendance ADD UNIQUE KEY unique_user_session (user_id, session_id)");
            console.log('✅ Added unique_user_session constraint');
        } catch (e) {
            if (e.message.includes('Duplicate key name')) {
                console.log('ℹ️ unique_user_session constraint already exists');
            } else {
                throw e;
            }
        }

        console.log('✅ Global Session Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
