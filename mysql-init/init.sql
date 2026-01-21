-- Frontend Test Portal: Fresh Schema Initialization
-- Consolidated Schema v1.1

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
    role ENUM('admin', 'faculty', 'student') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    picture VARCHAR(500) NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
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
    is_locked BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    restrictions JSON,
    level_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_difficulty (difficulty)
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
    expected_html TEXT,
    expected_css TEXT,
    expected_js TEXT,
    expected_screenshot_url VARCHAR(255),
    course_id VARCHAR(100),
    level INT,
    points INT DEFAULT 100,
    hints JSON,
    assets JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_course_level (course_id, level),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- ==========================================
-- 3. Student Progress & Attendance
-- ==========================================
CREATE TABLE test_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    test_identifier VARCHAR(255) NOT NULL COMMENT 'Composite: courseId_level',
    status ENUM('requested', 'approved', 'rejected') DEFAULT 'requested',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_test (user_id, test_identifier),
    INDEX idx_status (status)
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
    html_code TEXT,
    css_code TEXT,
    js_code TEXT,
    status ENUM('pending', 'passed', 'failed') DEFAULT 'pending',
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
    admin_override_status ENUM('passed', 'failed', 'none') DEFAULT 'none',
    admin_override_reason TEXT,
    INDEX idx_user_challenge (user_id, challenge_id),
    INDEX idx_status (status),
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
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_filename (filename)
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
    difficulty_rating INT,
    clarity_rating INT,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_feedback (user_id, submission_id)
);

-- ==========================================
-- 7. Default Seed Data
-- ==========================================

-- Admin User (Pass: admin123)
INSERT INTO users (id, username, password, email, full_name, role) VALUES
('user-admin-1', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin@example.com', 'Administrator', 'admin');

-- Faculty User (Pass: 123456)
INSERT INTO users (id, username, password, email, full_name, role) VALUES
('user-faculty-1', 'faculty', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'faculty@example.com', 'Professor X', 'faculty');

-- Demo Student (Pass: 123456)
INSERT INTO users (id, username, password, email, full_name, role) VALUES
('user-demo-student', 'student1', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'student1@example.com', 'Demo Student', 'student');

-- Sample Course
INSERT INTO courses (id, title, description, thumbnail, total_levels, difficulty) VALUES
('course-fullstack', 'Fullstack Development', 'Master both frontend and backend technologies.', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80', 12, 'Advanced');
