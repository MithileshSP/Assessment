-- Assessment Portal Database Schema
-- Version: 3.5.0 (Optimized)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- 0. Migration Ledger
-- ==========================================
CREATE TABLE IF NOT EXISTS applied_migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 1. User Management
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NULL,
    password_version VARCHAR(20) DEFAULT 'bcrypt',
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    roll_no VARCHAR(50) NULL,
    role ENUM('admin', 'student', 'faculty') DEFAULT 'student',
    is_blocked BOOLEAN DEFAULT TRUE,
    picture VARCHAR(500) NULL,
    current_session_id VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_available BOOLEAN DEFAULT TRUE,
    max_capacity INT DEFAULT 10,
    current_load INT DEFAULT 0,
    INDEX idx_role (role),
    INDEX idx_session (current_session_id),
    INDEX idx_roll_no (roll_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 2. Course & Challenge Structure
-- ==========================================
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail VARCHAR(255),
    total_levels INT DEFAULT 1,
    order_index INT NOT NULL DEFAULT 0,
    estimated_time VARCHAR(50) DEFAULT '1 hour',
    tags JSON,
    passing_threshold JSON,
    is_locked BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    prerequisite_course_id VARCHAR(100) NULL,
    restrictions JSON,
    level_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order (order_index),
    INDEX idx_prerequisite (prerequisite_course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    INDEX idx_course_level (course_id, level),
    INDEX idx_type (challenge_type),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 3. Sessions & Attendance
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '17:00:00',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    INDEX idx_course_level (course_id, level),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    copy_count INT DEFAULT 0,
    paste_count INT DEFAULT 0,
    fullscreen_exit_count INT DEFAULT 0,
    tab_switch_count INT DEFAULT 0,
    devtools_count INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_test_unique (user_id, test_identifier),
    INDEX idx_status_requested (status, requested_at),
    INDEX idx_session (session_id),
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    INDEX idx_status (overall_status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 4. Submissions & Evaluations
-- ==========================================
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
    INDEX idx_user_submitted (user_id, submitted_at),
    INDEX idx_challenge_status (challenge_id, status),
    INDEX idx_status_queued (status, submitted_at),
    INDEX idx_course_level_status (course_id, level, status),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS manual_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    faculty_id VARCHAR(100) NOT NULL,
    code_quality_score INT DEFAULT 0,
    requirements_score INT DEFAULT 0,
    expected_output_score INT DEFAULT 0,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_manual_evaluation (submission_id),
    INDEX idx_faculty (faculty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faculty_course_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id VARCHAR(100) NOT NULL,
    course_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_faculty_course (faculty_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submission_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    faculty_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('unassigned','assigned','in_progress','evaluated','reallocated','reopened') DEFAULT 'assigned',
    version INT NOT NULL DEFAULT 1,
    locked_by VARCHAR(100) NULL,
    locked_at TIMESTAMP NULL,
    reallocation_count INT NOT NULL DEFAULT 0,
    last_reallocated_at TIMESTAMP NULL,
    submission_weight INT NOT NULL DEFAULT 1,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_submission_assignment (submission_id),
    INDEX idx_faculty_status (faculty_id, status),
    INDEX idx_sa_faculty (faculty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS student_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    difficulty_rating INT DEFAULT 0,
    clarity_rating INT DEFAULT 0,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_feedback (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 5. Progress & Tracking
-- ==========================================
CREATE TABLE IF NOT EXISTS user_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    course_id VARCHAR(100) NOT NULL,
    current_level INT DEFAULT 1,
    completed_levels JSON,
    total_points INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_course (user_id, course_id),
    INDEX idx_user_points (user_id, total_points),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    INDEX idx_user_course_level (user_id, course_id, level),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 6. Assets & Logging
-- ==========================================
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
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_filename (filename),
    UNIQUE KEY idx_assets_checksum_category (checksum_sha256, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 7. Initial Data (Seeds)
-- ==========================================
INSERT IGNORE INTO users (id, username, password, email, full_name, role, is_blocked) VALUES
('user-admin-1', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin@example.com', 'Administrator', 'admin', FALSE),
('user-faculty-1', 'faculty', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'faculty@example.com', 'Professor X', 'faculty', FALSE);

INSERT IGNORE INTO courses (id, title, description, total_levels, order_index, tags) VALUES
('course-html-css', 'HTML & CSS Mastery', 'Master the fundamentals of web development', 1, 10, '["HTML", "CSS"]'),
('course-fullstack', 'Fullstack Development', 'Master both frontend and backend technologies.', 1, 20, '["Node.js", "React", "Database"]');

SET FOREIGN_KEY_CHECKS = 1;
