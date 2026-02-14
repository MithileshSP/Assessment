const { query, transaction } = require('../database/connection');

/**
 * Robust database migration script (v3.4.3 - Final fixes).
 * - Adds reference_image to test_attendance.
 * - Adds UNIQUE KEY to test_attendance (user_id, test_identifier).
 * - Safer order_index addition for courses.
 */
async function applyMigrations() {
  console.log('🔄 Checking for database migrations...');

  const addColumn = async (sql) => {
    try {
      await queryWithRetry(sql);
    } catch (e) {
      // 1060: Duplicate column name, 1061: Duplicate key name, 1050: Table already exists, 1062: Duplicate entry
      const isExpectedError =
        e.code === 'ER_DUP_FIELDNAME' ||
        e.code === 'ER_DUP_KEY' ||
        e.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
        e.errno === 1060 ||
        e.errno === 1061 ||
        e.errno === 1050 ||
        e.errno === 1062 ||
        e.errno === 1091;

      if (!isExpectedError) {
        console.error(`❌ Migration error [${e.code || e.errno}]: ${e.message}`);
        throw e; // Crash on unexpected errors to prevent running in corrupt state
      } else {
        console.log(`ℹ️ Migration info: Constraint/Column already exists.`);
      }
    }
  };

  const queryWithRetry = async (sql, params = [], retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await query(sql, params);
      } catch (e) {
        if ((e.code === 'ER_LOCK_DEADLOCK' || e.errno === 1213) && i < retries - 1) {
          const delay = Math.random() * 1000 + 500;
          console.warn(`⏳ Deadlock detected, retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw e;
      }
    }
  };

  try {
    // 1. Core Tables
    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail VARCHAR(255),
        total_levels INT DEFAULT 1,
        order_index INT NOT NULL DEFAULT 0,
        estimated_time VARCHAR(50),

        tags JSON,
        passing_threshold JSON,
        is_locked BOOLEAN DEFAULT FALSE,
        is_hidden BOOLEAN DEFAULT FALSE,
        prerequisite_course_id VARCHAR(100) NULL,
        restrictions JSON,
        level_settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prerequisite (prerequisite_course_id),
        INDEX idx_order (order_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Safer Column Additions (v3.4.3)
    await addColumn("ALTER TABLE courses ADD COLUMN order_index INT NOT NULL DEFAULT 0");


    await addColumn("ALTER TABLE courses ADD COLUMN estimated_time VARCHAR(50)");
    await addColumn("ALTER TABLE courses ADD COLUMN total_levels INT DEFAULT 1");
    await addColumn("ALTER TABLE courses ADD COLUMN tags JSON");
    await addColumn("ALTER TABLE courses ADD COLUMN prerequisite_course_id VARCHAR(100) NULL AFTER order_index");
    await addColumn("ALTER TABLE courses ADD COLUMN restrictions JSON");
    await addColumn("ALTER TABLE courses ADD COLUMN level_settings JSON");
    await addColumn("ALTER TABLE courses ADD COLUMN passing_threshold JSON");

    // v3.4.3: Safely drop legacy columns (MySQL doesn't support DROP COLUMN IF EXISTS)
    try { await queryWithRetry("ALTER TABLE courses DROP COLUMN difficulty"); } catch (e) { }
    try { await queryWithRetry("ALTER TABLE courses DROP COLUMN icon"); } catch (e) { }
    try { await queryWithRetry("ALTER TABLE courses DROP COLUMN color"); } catch (e) { }

    // Convert INDEX to UNIQUE INDEX safely
    await addColumn("ALTER TABLE courses DROP INDEX idx_order");
    await addColumn("ALTER TABLE courses ADD INDEX idx_order (order_index)");
    // Note: Removed UNIQUE from order_index in migration to avoid clashing defaults on upgrade.
    // Production servers should rely on the model for unique ordering if needed, or manual cleanup.

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS challenges (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
        description TEXT,
        instructions TEXT,
        tags JSON,
        time_limit INT DEFAULT 30,
        passing_threshold JSON,
        expected_html LONGTEXT,
        expected_css LONGTEXT,
        expected_js LONGTEXT,
        html LONGTEXT,
        css LONGTEXT,
        js LONGTEXT,
        expected_screenshot_url VARCHAR(255),
        expected_screenshot_data MEDIUMBLOB,
        challenge_type ENUM('web', 'nodejs') DEFAULT 'web',
        expected_output TEXT,
        course_id VARCHAR(100),
        level INT,
        points INT DEFAULT 100,
        hints JSON,
        assets JSON,
        additional_files JSON,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_difficulty (difficulty),
        INDEX idx_course_level (course_id, level),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Individual column additions for challenges (safety for older DBs)
    await addColumn("ALTER TABLE challenges ADD COLUMN expected_screenshot_data MEDIUMBLOB");
    await addColumn("ALTER TABLE challenges ADD COLUMN challenge_type ENUM('web', 'nodejs') DEFAULT 'web'");
    await addColumn("ALTER TABLE challenges ADD COLUMN expected_output TEXT");
    await addColumn("ALTER TABLE challenges ADD COLUMN additional_files JSON");

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(100) PRIMARY KEY,
        challenge_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100),
        level INT,
        session_id VARCHAR(100) NULL,
        candidate_name VARCHAR(100),
        html_code LONGTEXT,
        css_code LONGTEXT,
        js_code LONGTEXT,
        additional_files JSON,
        status ENUM('pending', 'passed', 'failed', 'queued', 'evaluating', 'error', 'saved') DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        evaluated_at TIMESTAMP NULL,
        structure_score INT DEFAULT 0,
        visual_score INT DEFAULT 0,
        content_score INT DEFAULT 0,
        final_score INT DEFAULT 0,
        passed BOOLEAN DEFAULT FALSE,
        evaluation_result JSON,
        user_screenshot VARCHAR(500),
        user_screenshot_data MEDIUMBLOB,
        expected_screenshot VARCHAR(500),
        expected_screenshot_data MEDIUMBLOB,
        diff_screenshot VARCHAR(500),
        diff_screenshot_data MEDIUMBLOB,
        user_feedback TEXT,
        admin_override_status ENUM('passed', 'failed', 'none') DEFAULT 'none',
        admin_override_reason TEXT,
        is_exported TINYINT(1) DEFAULT 0,
        exported_at TIMESTAMP NULL,
        INDEX idx_user_challenge (user_id, challenge_id),
        INDEX idx_status (status),
        INDEX idx_course_level (course_id, level),
        INDEX idx_submissions_session (session_id, status),
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Individual column additions for submissions
    await addColumn("ALTER TABLE submissions ADD COLUMN course_id VARCHAR(100) AFTER user_id");
    await addColumn("ALTER TABLE submissions ADD COLUMN level INT AFTER course_id");
    await addColumn("ALTER TABLE submissions ADD COLUMN session_id VARCHAR(100) AFTER level");
    await addColumn("ALTER TABLE submissions ADD COLUMN user_feedback TEXT NULL AFTER expected_screenshot");
    await addColumn("ALTER TABLE submissions ADD COLUMN diff_screenshot VARCHAR(500) AFTER user_screenshot");
    await addColumn("ALTER TABLE submissions ADD COLUMN admin_override_status ENUM('passed', 'failed', 'none') DEFAULT 'none'");
    await addColumn("ALTER TABLE submissions ADD COLUMN admin_override_reason TEXT");
    await addColumn("ALTER TABLE submissions ADD COLUMN user_screenshot_data MEDIUMBLOB");
    await addColumn("ALTER TABLE submissions ADD COLUMN expected_screenshot_data MEDIUMBLOB");
    await addColumn("ALTER TABLE submissions ADD COLUMN diff_screenshot_data MEDIUMBLOB");
    await addColumn("ALTER TABLE submissions ADD COLUMN exported_at TIMESTAMP NULL");
    await addColumn("ALTER TABLE submissions ADD INDEX idx_submissions_session (session_id, status)");

    // 2. Schedule & Sessions
    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS daily_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        start_time TIME NOT NULL DEFAULT '09:00:00',
        end_time TIME NOT NULL DEFAULT '17:00:00',
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS global_test_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        duration_minutes INT NOT NULL DEFAULT 60,
        created_by VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_reason VARCHAR(50),
        forced_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_active (is_active),
        INDEX idx_course_level (course_id, level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS test_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        test_identifier VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) NULL,
        status ENUM('requested', 'approved', 'rejected') DEFAULT 'requested',
        scheduled_status ENUM('none', 'scheduled', 'activated', 'expired') DEFAULT 'none',
        reference_image VARCHAR(500) NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        approved_by VARCHAR(100),
        attempt_started_at TIMESTAMP NULL,
        attempt_submitted_at TIMESTAMP NULL,
        is_used BOOLEAN DEFAULT FALSE,
        locked BOOLEAN DEFAULT FALSE,
        locked_at TIMESTAMP NULL,
        locked_reason VARCHAR(255) NULL,
        violation_count INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY idx_user_test_unique (user_id, test_identifier),
        INDEX idx_status (status),
        INDEX idx_session (session_id),
        INDEX idx_scheduled (scheduled_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // test_attendance fixes (v3.4.3)
    await addColumn("ALTER TABLE test_attendance ADD COLUMN reference_image VARCHAR(500) NULL AFTER status");
    // v3.6.0: Add scheduled_status column for pre-authorization feature
    await addColumn("ALTER TABLE test_attendance ADD COLUMN scheduled_status ENUM('none', 'scheduled', 'activated', 'expired') DEFAULT 'none' AFTER status");
    await addColumn("ALTER TABLE test_attendance ADD INDEX idx_scheduled (scheduled_status)");

    // v3.6.1: Add detailed violation tracking columns (Fix for 500 Error)
    await addColumn("ALTER TABLE test_attendance ADD COLUMN violation_count INT DEFAULT 0");
    await addColumn("ALTER TABLE test_attendance ADD COLUMN copy_count INT DEFAULT 0");
    await addColumn("ALTER TABLE test_attendance ADD COLUMN paste_count INT DEFAULT 0");
    await addColumn("ALTER TABLE test_attendance ADD COLUMN fullscreen_exit_count INT DEFAULT 0");
    await addColumn("ALTER TABLE test_attendance ADD COLUMN tab_switch_count INT DEFAULT 0");
    await addColumn("ALTER TABLE test_attendance ADD COLUMN devtools_count INT DEFAULT 0");
    // v3.4.3: Cleanup duplicate test_attendance records before unique key
    await queryWithRetry(`
      DELETE t1 FROM test_attendance t1
      INNER JOIN test_attendance t2 
      WHERE t1.id < t2.id 
      AND t1.user_id = t2.user_id 
      AND t1.test_identifier = t2.test_identifier
    `);

    // Change INDEX to UNIQUE KEY safely
    try {
      await queryWithRetry("ALTER TABLE test_attendance DROP INDEX idx_user_test");
    } catch (e) { }


    await addColumn("ALTER TABLE test_attendance ADD UNIQUE KEY idx_user_test_unique (user_id, test_identifier)");

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS test_sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        submission_ids JSON NOT NULL,
        total_questions INT DEFAULT 0,
        passed_count INT DEFAULT 0,
        overall_status ENUM('passed', 'failed', 'pending') DEFAULT 'pending',
        user_feedback TEXT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        INDEX idx_user (user_id),
        INDEX idx_course_level (course_id, level),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Progress & Access
    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        current_level INT DEFAULT 1,
        completed_levels JSON,
        total_points INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_course (user_id, course_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS level_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        total_score DECIMAL(5,2) DEFAULT 0,
        passed BOOLEAN DEFAULT FALSE,
        feedback TEXT,
        question_results JSON,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_course (user_id, course_id),
        INDEX idx_completed_at (completed_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Assets & Logging
    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        original_name VARCHAR(255) NOT NULL,
        path VARCHAR(500) NOT NULL,
        url VARCHAR(500) NOT NULL,
        type VARCHAR(100),
        size INT,
        category VARCHAR(50) DEFAULT 'general',
        checksum_sha256 CHAR(64) NULL,
        file_data LONGBLOB,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_modified TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_filename (filename),
        UNIQUE KEY idx_assets_checksum_category (checksum_sha256, category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // User table fixes
    await addColumn("ALTER TABLE users ADD COLUMN roll_no VARCHAR(50) NULL AFTER full_name");
    await addColumn("ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT TRUE AFTER role");
    await addColumn("ALTER TABLE users ADD COLUMN picture VARCHAR(500) NULL AFTER is_blocked");
    await addColumn("ALTER TABLE users ADD COLUMN current_session_id VARCHAR(100) NULL AFTER picture");
    await addColumn("ALTER TABLE users ADD COLUMN password_version ENUM('sha256', 'bcrypt') DEFAULT 'sha256' AFTER password");
    await addColumn("ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL AFTER created_at");

    // 6. Seeding
    console.log('🌱 Seeding initial data (idempotent)...');

    await queryWithRetry(`
      INSERT IGNORE INTO users (id, username, password, email, full_name, role, created_at) VALUES
      ('user-admin-1', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin@example.com', 'Administrator', 'admin', NOW()),
      ('user-faculty-1', 'faculty', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'faculty@example.com', 'Professor X', 'faculty', NOW())
    `);

    await addColumn("UPDATE users SET is_blocked = FALSE WHERE username IN ('admin', 'faculty')");

    await queryWithRetry(`
      INSERT INTO courses (id, title, description, total_levels, estimated_time, tags, order_index, created_at) VALUES
      ('course-html-css', 'HTML & CSS Mastery', 'Master the fundamentals of web development', 1, '20 hours', '["HTML", "CSS"]', 10, NOW()),
      ('course-fullstack', 'Fullstack Development', 'Master both frontend and backend technologies.', 1, '40 hours', '["Node.js", "React", "Database"]', 20, NOW())
      ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      description = VALUES(description),
      tags = VALUES(tags),
      estimated_time = VALUES(estimated_time);
    `);

    // Final Fix: Consistency for order_index
    await addColumn("UPDATE courses SET order_index = 10 WHERE id = 'course-html-css' AND (order_index = 0 OR order_index IS NULL)");
    await addColumn("UPDATE courses SET order_index = 20 WHERE id = 'course-fullstack' AND (order_index = 0 OR order_index IS NULL)");

    // v3.4.4: Allow NULL passwords for Google sign-in users
    try {
      await queryWithRetry("ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL");
      console.log('✅ Modified password column to allow NULL');
    } catch (e) {
      console.log('ℹ️ Password column already allows NULL or modification skipped');
    }

    // v3.4.4: Add password_version column if not exists
    await addColumn("ALTER TABLE users ADD COLUMN password_version VARCHAR(20) DEFAULT 'bcrypt' AFTER password");

    // v3.4.5: Create faculty evaluation tables
    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS manual_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id VARCHAR(100) NOT NULL,
        faculty_id VARCHAR(100) NOT NULL,
        code_quality_score INT DEFAULT 0,
        requirements_score INT DEFAULT 0,
        expected_output_score INT DEFAULT 0,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_manual_evaluation (submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS submission_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id VARCHAR(100) NOT NULL,
        faculty_id VARCHAR(100) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'evaluated') DEFAULT 'pending',
        UNIQUE KEY unique_submission_assignment (submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS student_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        feedback_text TEXT,
        rating INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_student_feedback (submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // v3.4.7: Update student_feedback columns to match UI
    await addColumn("ALTER TABLE student_feedback ADD COLUMN difficulty_rating INT DEFAULT 0 AFTER user_id");
    await addColumn("ALTER TABLE student_feedback ADD COLUMN clarity_rating INT DEFAULT 0 AFTER difficulty_rating");
    await addColumn("ALTER TABLE student_feedback ADD COLUMN comments TEXT AFTER clarity_rating");
    // Drop old columns if they exist (optional cleanup)
    try { await queryWithRetry("ALTER TABLE student_feedback DROP COLUMN rating"); } catch (e) { }
    try { await queryWithRetry("ALTER TABLE student_feedback DROP COLUMN feedback_text"); } catch (e) { }

    console.log('✅ Full migrations applied successfully (v3.4.7)');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

module.exports = { applyMigrations };
