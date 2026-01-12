/**
 * Fix Database Schema
 * Ensures all required tables (student_feedback, test_attendance, global_sessions) 
 * exist to prevent 500 errors.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
// Override DB_HOST for local script execution if it's set to docker hostname
if (process.env.DB_HOST === 'portal_mysql') process.env.DB_HOST = 'localhost';

const { query } = require('../database/connection');

async function fixSchema() {
    console.log('🚀 Starting database schema fix...');

    try {
        // 1. Create student_feedback table
        const createFeedbackTable = `
      CREATE TABLE IF NOT EXISTS student_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        submission_id VARCHAR(100) NOT NULL,
        difficulty_rating INT DEFAULT 3,
        clarity_rating INT DEFAULT 3,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_submission (user_id, submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
        await query(createFeedbackTable);
        console.log('✅ table student_feedback verified/created.');

        // 2. Create global_sessions table
        const createGlobalSessions = `
      CREATE TABLE IF NOT EXISTS global_sessions (
        id VARCHAR(100) PRIMARY KEY,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_minutes INT NOT NULL,
        created_by VARCHAR(100),
        status ENUM('active', 'completed', 'expired') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
        await query(createGlobalSessions);
        console.log('✅ table global_sessions verified/created.');

        // 3. Create test_attendance table
        const createAttendanceTable = `
      CREATE TABLE IF NOT EXISTS test_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        test_identifier VARCHAR(255) NOT NULL,
        session_id VARCHAR(100) NULL,
        status ENUM('requested', 'approved', 'rejected') DEFAULT 'requested',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        approved_by VARCHAR(100),
        attempt_started_at TIMESTAMP NULL,
        attempt_submitted_at TIMESTAMP NULL,
        is_used BOOLEAN DEFAULT FALSE,
        INDEX idx_user_test (user_id, test_identifier),
        INDEX idx_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
        await query(createAttendanceTable);
        console.log('✅ table test_attendance verified/created.');

        // 4. Ensure user_feedback exists in submissions
        try {
            await query('ALTER TABLE submissions ADD COLUMN user_feedback TEXT NULL AFTER expected_screenshot');
            console.log('✅ Column user_feedback added to submissions.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Column user_feedback already exists in submissions.');
            } else {
                throw e;
            }
        }

        console.log('✨ Schema fix completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Schema fix failed:', error);
        process.exit(1);
    }
}

fixSchema();
