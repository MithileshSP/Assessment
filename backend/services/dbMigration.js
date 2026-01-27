const { query, transaction } = require('../database/connection');

async function applyMigrations() {
  console.log('🔄 Checking for database migrations...');

  const addColumn = async (sql) => {
    try {
      await query(sql);
    } catch (e) {
      // 1060: Duplicate column name
      // 1061: Duplicate key name
      // 1050: Table already exists
      if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060 && e.errno !== 1061) {
        console.warn(`⚠️ Migration info: ${e.message}`);
      }
    }
  };

  try {
    // 0. Base Tables
    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail VARCHAR(255),
        icon VARCHAR(10),
        color VARCHAR(20),
        total_levels INT DEFAULT 1,
        estimated_time VARCHAR(50),
        difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
        tags JSON,
        is_locked BOOLEAN DEFAULT FALSE,
        is_hidden BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_difficulty (difficulty),
        INDEX idx_is_locked (is_locked),
        INDEX idx_is_hidden (is_hidden)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
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
        expected_screenshot_url VARCHAR(255),
        expected_screenshot_data MEDIUMBLOB,
        course_id VARCHAR(100),
        level INT,
        assets JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_difficulty (difficulty),
        INDEX idx_course_level (course_id, level),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(100) PRIMARY KEY,
        challenge_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        candidate_name VARCHAR(100),
        html_code LONGTEXT,
        css_code LONGTEXT,
        js_code LONGTEXT,
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
        admin_override_status ENUM('none', 'passed', 'failed') DEFAULT 'none',
        admin_override_reason TEXT,
        course_id VARCHAR(100),
        level INT,
        INDEX idx_challenge (challenge_id),
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        INDEX idx_submitted_at (submitted_at),
        INDEX idx_course_level (course_id, level),
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
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

    await query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        current_level INT DEFAULT 1,
        completed_levels JSON,
        total_points INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_course (user_id, course_id),
        INDEX idx_user_course (user_id, course_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 1. Update Users Table Role
    const columns = await query("SHOW COLUMNS FROM users LIKE 'role'");
    if (columns.length > 0) {
      const type = columns[0].Type;
      // Check if 'faculty' is already in the enum
      if (!type.includes("'faculty'")) {
        console.log('⚡ Updating users role column...');
        await query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'student', 'faculty') DEFAULT 'student'");
      }
    }

    // 1.1 Update Users Table Schema (Match v3.0)
    try {
      await addColumn("ALTER TABLE users ADD COLUMN picture VARCHAR(500) NULL AFTER role");
      await addColumn("ALTER TABLE users ADD COLUMN current_session_id VARCHAR(100) NULL AFTER picture");
      await addColumn("ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL AFTER created_at");
      await addColumn("ALTER TABLE users ADD INDEX idx_session_id (current_session_id)");
    } catch (e) {
      console.warn('⚠️ Users table modification info:', e.message);
    }

    // 2. Global Test Sessions Table
    await query(`
      CREATE TABLE IF NOT EXISTS global_test_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        duration_minutes INT NOT NULL,
        created_by VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_reason VARCHAR(50),
        forced_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Test Attendance Table
    await query(`
      CREATE TABLE IF NOT EXISTS test_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        test_identifier VARCHAR(255) NOT NULL,
        session_id INT NULL,
        status ENUM('requested', 'approved', 'rejected') DEFAULT 'requested',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        approved_by VARCHAR(100),
        attempt_started_at TIMESTAMP NULL,
        attempt_submitted_at TIMESTAMP NULL,
        is_used BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_test (user_id, test_identifier),
        INDEX idx_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure session_id and other security columns exist
    try {
      await query("ALTER TABLE test_attendance MODIFY COLUMN session_id INT NULL");
      await addColumn("ALTER TABLE test_attendance ADD COLUMN locked BOOLEAN DEFAULT FALSE AFTER is_used");
      await addColumn("ALTER TABLE test_attendance ADD COLUMN locked_at TIMESTAMP NULL AFTER locked");
      await addColumn("ALTER TABLE test_attendance ADD COLUMN locked_reason VARCHAR(255) NULL AFTER locked_at");
      await addColumn("ALTER TABLE test_attendance ADD COLUMN violation_count INT DEFAULT 0 AFTER locked_reason");
      console.log('✅ test_attendance columns verified.');
    } catch (e) {
      console.warn('⚠️ test_attendance modification warning:', e.message);
    }

    // Ensure test_sessions schema matches v3.0
    try {
      const tsColumns = await query("SHOW COLUMNS FROM test_sessions LIKE 'overall_status'");
      if (tsColumns.length > 0 && !tsColumns[0].Type.includes("'pending'")) {
        console.log('⚡ Updating test_sessions status enum...');
        await query("ALTER TABLE test_sessions MODIFY COLUMN overall_status ENUM('passed', 'failed', 'pending') DEFAULT 'pending'");
      }

      // Ensure course_id FK exists for test_sessions
      await addColumn("ALTER TABLE test_sessions ADD FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE");
    } catch (e) {
      if (e.code !== 'ER_DUP_KEY' && e.code !== 'ER_FK_DUP_NAME') {
        console.warn('⚠️ test_sessions modification info:', e.message);
      }
    }
    await query(`
      CREATE TABLE IF NOT EXISTS faculty_course_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        faculty_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_faculty_course (faculty_id, course_id)
      )
    `);

    // 5. Submission Assignments
    await query(`
      CREATE TABLE IF NOT EXISTS submission_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id VARCHAR(100) NOT NULL,
        faculty_id VARCHAR(100) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'evaluated') DEFAULT 'pending',
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_submission_assignment (submission_id)
      )
    `);

    // 6. Manual Evaluations
    await query(`
      CREATE TABLE IF NOT EXISTS manual_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id VARCHAR(100) NOT NULL,
        faculty_id VARCHAR(100) NOT NULL,
        code_quality_score INT DEFAULT 0 COMMENT 'Max 40',
        requirements_score INT DEFAULT 0 COMMENT 'Max 25',
        expected_output_score INT DEFAULT 0 COMMENT 'Max 35',
        total_score INT GENERATED ALWAYS AS (code_quality_score + requirements_score + expected_output_score) STORED,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_manual_evaluation (submission_id)
      )
    `);

    // 7. Student Feedback Table
    await query(`
      CREATE TABLE IF NOT EXISTS student_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        submission_id VARCHAR(100) NOT NULL,
        difficulty_rating INT DEFAULT 3,
        clarity_rating INT DEFAULT 3,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_submission (user_id, submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7.1 level_access table
    await query(`
      CREATE TABLE IF NOT EXISTS level_access (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        is_locked BOOLEAN DEFAULT FALSE,
        locked_by VARCHAR(100),
        locked_at TIMESTAMP NULL,
        unlocked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_level (user_id, course_id, level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7.1.1 user_assignments table (Legacy compatibility)
    await query(`
      CREATE TABLE IF NOT EXISTS user_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_id VARCHAR(100) NOT NULL,
        level INT NOT NULL,
        challenge_id VARCHAR(100) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP NULL,
        UNIQUE KEY unique_user_level (user_id, course_id, level),
        INDEX idx_user_course_level (user_id, course_id, level),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7.1.2 level_completions table
    await query(`
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

    // 7.2 assets table
    await query(`
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
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7.3 activity_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id VARCHAR(100),
        details JSON,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Add mission columns to submissions
    // Update status ENUM to include new states
    await addColumn("ALTER TABLE submissions MODIFY COLUMN status ENUM('pending', 'passed', 'failed', 'queued', 'evaluating', 'error', 'saved') DEFAULT 'pending'");
    await addColumn('ALTER TABLE submissions ADD COLUMN user_feedback TEXT NULL AFTER expected_screenshot');
    await addColumn('ALTER TABLE submissions ADD COLUMN diff_screenshot VARCHAR(500) AFTER user_screenshot');
    await addColumn("ALTER TABLE submissions ADD COLUMN admin_override_status ENUM('none', 'passed', 'failed') DEFAULT 'none'");
    await addColumn('ALTER TABLE submissions ADD COLUMN admin_override_reason TEXT');

    // BLOB Columns for stability (if they don't exist in existing DB)
    await addColumn('ALTER TABLE submissions ADD COLUMN user_screenshot_data MEDIUMBLOB');
    await addColumn('ALTER TABLE submissions ADD COLUMN expected_screenshot_data MEDIUMBLOB');
    await addColumn('ALTER TABLE submissions ADD COLUMN diff_screenshot_data MEDIUMBLOB');
    await addColumn('ALTER TABLE assets ADD COLUMN file_data LONGBLOB');
    await addColumn('ALTER TABLE challenges ADD COLUMN expected_screenshot_data MEDIUMBLOB');

    // Performance Indexes for Scalability
    await addColumn('ALTER TABLE submissions ADD INDEX idx_user_challenge_status (user_id, challenge_id, status)');

    // Upgrade text columns for scalability
    await addColumn('ALTER TABLE submissions MODIFY COLUMN html_code LONGTEXT');
    await addColumn('ALTER TABLE submissions MODIFY COLUMN css_code LONGTEXT');
    await addColumn('ALTER TABLE submissions MODIFY COLUMN js_code LONGTEXT');
    await addColumn('ALTER TABLE challenges MODIFY COLUMN expected_html LONGTEXT');
    await addColumn('ALTER TABLE challenges MODIFY COLUMN expected_css LONGTEXT');
    await addColumn('ALTER TABLE challenges MODIFY COLUMN expected_js LONGTEXT');

    console.log('✅ Submissions table columns verified.');

    // 9. Seed Default Users
    console.log('👥 Checking for default users...');
    const usersToSeed = [
      { id: 'user-admin-1', username: 'admin', password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', email: 'admin@example.com', full_name: 'Administrator', role: 'admin' },
      { id: 'user-demo-student', username: 'student1', password: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', email: 'student1@example.com', full_name: 'Demo Student', role: 'student' },
      { id: 'user-faculty-1', username: 'faculty', password: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', email: 'faculty@example.com', full_name: 'Professor X', role: 'faculty' }
    ];

    for (const u of usersToSeed) {
      const exists = await query("SELECT id FROM users WHERE id = ? OR username = ? OR email = ?", [u.id, u.username, u.email]);
      if (exists.length === 0) {
        console.log(`👤 Seeding user: ${u.username}`);
        await query(
          "INSERT INTO users (id, username, password, email, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
          [u.id, u.username, u.password, u.email, u.full_name, u.role]
        );
      }
    }

    // 10. Courses Table Enhancements
    try {
      await addColumn("ALTER TABLE courses ADD COLUMN restrictions JSON NULL AFTER is_hidden");
      console.log('✅ Column restrictions verified.');
    } catch (e) {
      console.warn('⚠️ Column restrictions warning:', e.message);
    }

    try {
      await addColumn("ALTER TABLE courses ADD COLUMN level_settings JSON NULL AFTER restrictions");
      console.log('✅ Column level_settings verified.');
    } catch (e) {
      console.warn('⚠️ Column level_settings warning:', e.message);
    }

    // 11. Seed Courses if empty
    try {
      const courseCount = await query("SELECT COUNT(*) as count FROM courses");
      if (courseCount[0].count === 0) {
        console.log('🌱 Seeding initial courses...');
        await query(`
          INSERT INTO courses (id, title, description, icon, color, total_levels, estimated_time, difficulty, tags, created_at) VALUES
          ('course-html-css', 'HTML & CSS Mastery', 'Master the fundamentals of web development', '🎨', '#e34c26', 10, '20 hours', 'Beginner', '["HTML", "CSS"]', NOW()),
          ('course-fullstack', 'Fullstack Development', 'Become a complete web developer', '💻', '#3B82F6', 12, '40 hours', 'Intermediate', '["Node.js", "React", "Database"]', NOW())
        `);
      }
    } catch (e) {
      console.warn('⚠️ Seeding courses warning:', e.message);
    }

    // 12. Seed Challenges if empty
    try {
      const challengeCount = await query("SELECT COUNT(*) as count FROM challenges");
      if (challengeCount[0].count === 0) {
        console.log('🌱 Seeding initial challenges...');
        await query(`
          INSERT INTO challenges (id, title, difficulty, description, instructions, tags, time_limit, passing_threshold, expected_html, expected_css, expected_js, course_id, level, assets, created_at) VALUES
          ('html-task-1', 'Build a Basic Profile', 'Easy', 'Create a simple user profile card.', 'Use <h1> for name and <p> for bio.', '["html", "css"]', 30, '{"structure": 80, "visual": 70, "overall": 75}', '<h1>User Name</h1><p>Bio here...</p>', 'h1 { color: blue; }', '', 'course-html-css', 1, '{"images": [], "reference": ""}', NOW()),
          ('fs-task-1', 'API Integration', 'Medium', 'Fetch data from a dummy API.', 'Use fetch() to get data.', '["javascript", "api"]', 45, '{"structure": 70, "visual": 60, "overall": 70}', '<div id="output"></div>', '', 'fetch("https://api.example.com").then(r => r.json());', 'course-fullstack', 1, '{"images": [], "reference": ""}', NOW())
        `);
      }
    } catch (e) {
      console.warn('⚠️ Seeding challenges warning:', e.message);
    }

    console.log('✅ Experimental migrations applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

module.exports = { applyMigrations };
