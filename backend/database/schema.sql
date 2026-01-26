-- Frontend Test Portal Database Schema v3.0 (Production Scalability Edition)
-- MySQL Database Setup

CREATE DATABASE IF NOT EXISTS fullstack_test_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fullstack_test_portal;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    role ENUM('admin', 'faculty', 'student') DEFAULT 'student',
    picture VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Courses Table
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
    restrictions JSON,
    level_settings JSON,
    is_locked BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_difficulty (difficulty),
    INDEX idx_is_locked (is_locked),
    INDEX idx_is_hidden (is_hidden)
);

-- Challenges Table
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
    points INT DEFAULT 100,
    hints JSON,
    assets JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_difficulty (difficulty),
    INDEX idx_course_level (course_id, level),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- Submissions Table
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
    user_feedback TEXT,
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
);

-- Test Sessions Table
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
);

-- Global Test Sessions Table
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
);

-- Test Attendance Table
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
    locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMP NULL,
    locked_reason VARCHAR(255) NULL,
    violation_count INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_test (user_id, test_identifier),
    INDEX idx_session (session_id)
);

-- Faculty Assignments
CREATE TABLE IF NOT EXISTS faculty_course_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id VARCHAR(100) NOT NULL,
    course_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_faculty_course (faculty_id, course_id)
);

-- Submission Assignments
CREATE TABLE IF NOT EXISTS submission_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    faculty_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'evaluated') DEFAULT 'pending',
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_submission_assignment (submission_id)
);

-- Manual Evaluations
CREATE TABLE IF NOT EXISTS manual_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    faculty_id VARCHAR(100) NOT NULL,
    code_quality_score INT DEFAULT 0,
    requirements_score INT DEFAULT 0,
    expected_output_score INT DEFAULT 0,
    total_score INT GENERATED ALWAYS AS (code_quality_score + requirements_score + expected_output_score) STORED,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_manual_evaluation (submission_id)
);

-- Assets Table
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
    INDEX idx_category (category)
);

-- Level Access Restrictions
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
);

-- Activity Logs
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
);

-- Insert default admin user (password: admin123)
INSERT INTO users (id, username, password, email, full_name, role, created_at) VALUES
('user-admin-1', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin@example.com', 'Administrator', 'admin', '2024-01-01 00:00:00');

-- Insert demo student (password: 123456)
INSERT INTO users (id, username, password, email, full_name, role, created_at) VALUES
('user-demo-student', 'student1', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'student1@example.com', 'Demo Student', 'student', '2024-01-01 00:00:00');
