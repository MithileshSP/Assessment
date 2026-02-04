-- Frontend Test Portal: Fresh Schema Initialization
-- Consolidated Schema v3.0 - Complete with all fixes and recent migrations

DROP DATABASE IF EXISTS fullstack_test_portal;
CREATE DATABASE fullstack_test_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fullstack_test_portal;

-- ==========================================
-- 1. Core Users & Authorization
-- ==========================================
CREATE TABLE users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    roll_no VARCHAR(50) NULL,
    role ENUM('admin', 'faculty', 'student') DEFAULT 'student',
    is_blocked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    picture VARCHAR(500) NULL,
    current_session_id VARCHAR(100) NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_session_id (current_session_id)
);

-- ==========================================
-- 2. Curriculum Management
-- ==========================================
CREATE TABLE courses (
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
    passing_threshold JSON,
    is_locked BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    prerequisite_course_id VARCHAR(100) NULL,
    restrictions JSON,
    level_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_difficulty (difficulty),
    INDEX idx_prerequisite (prerequisite_course_id)
);

CREATE TABLE challenges (
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
    challenge_type ENUM('web', 'nodejs') DEFAULT 'web',
    expected_output TEXT,
    course_id VARCHAR(100),
    level INT,
    points INT DEFAULT 100,
    hints JSON,
    assets JSON,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_course_level (course_id, level),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- ==========================================
-- 3. Global Test Sessions & Attendance
-- ==========================================
CREATE TABLE daily_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '17:00:00',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE global_test_sessions (
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
);

CREATE TABLE test_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    test_identifier VARCHAR(255) NOT NULL COMMENT 'Composite: courseId_level',
    session_id INT NULL,
    status ENUM('requested', 'approved', 'rejected') DEFAULT 'requested',
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
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_test (user_id, test_identifier),
    INDEX idx_status (status),
    INDEX idx_session (session_id)
);

CREATE TABLE test_sessions (
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
);

CREATE TABLE user_progress (
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
);

CREATE TABLE level_access (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    course_id VARCHAR(100) NOT NULL,
    level INT NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by VARCHAR(100),
    locked_at TIMESTAMP NULL,
    unlocked_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_level (user_id, course_id, level),
    INDEX idx_user_course (user_id, course_id),
    INDEX idx_is_locked (is_locked)
);

CREATE TABLE user_assignments (
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
);

CREATE TABLE level_completions (
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
);

-- ==========================================
-- 4. Submissions & Evaluations
-- ==========================================
CREATE TABLE submissions (
    id VARCHAR(100) PRIMARY KEY,
    challenge_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    course_id VARCHAR(100),
    level INT,
    candidate_name VARCHAR(100),
    html_code LONGTEXT,
    css_code LONGTEXT,
    js_code LONGTEXT,
    additional_files JSON,
    status ENUM('pending', 'passed', 'failed', 'queued', 'evaluating', 'error') DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TIMESTAMP NULL,
    structure_score INT DEFAULT 0,
    visual_score INT DEFAULT 0,
    content_score INT DEFAULT 0,
    final_score INT DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    evaluation_result JSON,
    user_screenshot VARCHAR(500),
    expected_screenshot VARCHAR(500),
    diff_screenshot VARCHAR(500),
    user_feedback TEXT,
    admin_override_status ENUM('passed', 'failed', 'none') DEFAULT 'none',
    admin_override_reason TEXT,
    is_exported TINYINT(1) DEFAULT 0,
    exported_at TIMESTAMP NULL,
    INDEX idx_user_challenge (user_id, challenge_id),
    INDEX idx_status (status),
    INDEX idx_course_level (course_id, level),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE manual_evaluations (
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
);

-- ==========================================
-- 5. Faculty Workspace
-- ==========================================
CREATE TABLE faculty_course_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id VARCHAR(100) NOT NULL,
    course_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_faculty_course (faculty_id, course_id)
);

CREATE TABLE submission_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    faculty_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'evaluated') DEFAULT 'pending',
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_submission_assignment (submission_id)
);

-- ==========================================
-- 6. Infrastructure & Logs
-- ==========================================
CREATE TABLE assets (
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
    INDEX idx_assets_uploaded_at (uploaded_at),
    UNIQUE KEY idx_assets_checksum_category (checksum_sha256, category)
);

CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details JSON,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE student_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    submission_id VARCHAR(100) NOT NULL,
    difficulty_rating INT DEFAULT 3,
    clarity_rating INT DEFAULT 3,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_feedback (user_id, submission_id)
);

-- ==========================================
-- 7. Default Seed Data
-- ==========================================

-- Admin User (Pass: admin123)
-- Hash: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
INSERT INTO users (id, username, password, email, full_name, role, is_blocked) VALUES
('user-admin-1', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin@example.com', 'Administrator', 'admin', FALSE);

-- Faculty User (Pass: 123456)
-- Hash: 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
INSERT INTO users (id, username, password, email, full_name, role, is_blocked) VALUES
('user-faculty-1', 'faculty', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'faculty@example.com', 'Professor X', 'faculty', FALSE);

-- Demo Student (Pass: 123456)
INSERT INTO users (id, username, password, email, full_name, role, is_blocked) VALUES
('user-demo-student', 'student1', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'student1@example.com', 'Demo Student', 'student', TRUE);

-- Sample Course
INSERT INTO courses (id, title, description, thumbnail, total_levels, difficulty, passing_threshold) VALUES
('course-fullstack', 'Fullstack Development', 'Master both frontend and backend technologies.', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80', 12, 'Advanced', '{"structure": 80, "visual": 80, "overall": 75}');
