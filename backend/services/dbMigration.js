const { query, transaction } = require('../database/connection');

async function applyMigrations() {
    console.log('🔄 Checking for database migrations...');

    try {
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

        // 2. Test Attendance Table
        await query(`
      CREATE TABLE IF NOT EXISTS test_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        test_identifier VARCHAR(255) NOT NULL COMMENT 'Composite Key: courseId_level',
        status ENUM('requested', 'approved', 'rejected') DEFAULT 'requested',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        approved_by VARCHAR(100),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_test (user_id, test_identifier),
        INDEX idx_status (status)
      )
    `);

        // 3. Faculty Course Assignments
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

        // 4. Submission Assignments
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

        // 5. Manual Evaluations
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

        // 6. Student Feedback
        await query(`
      CREATE TABLE IF NOT EXISTS student_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        submission_id VARCHAR(100) NOT NULL,
        difficulty_rating INT,
        clarity_rating INT,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      )
    `);

        // 7. Insert Dummy Faculty
        // We try to insert, if exists we update role to ensure they are faculty
        const facultyCheck = await query("SELECT id FROM users WHERE email = 'faculty@example.com'");
        if (facultyCheck.length === 0) {
            console.log('⚡ Creating default faculty user...');
            await query(`
            INSERT INTO users (id, username, password, email, full_name, role, created_at) VALUES
            ('user-faculty-1', 'faculty', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'faculty@example.com', 'Professor X', 'faculty', '2024-01-01 00:00:00')
        `);
        } else {
            // Ensure role is faculty
            await query("UPDATE users SET role = 'faculty' WHERE email = 'faculty@example.com'");
        }

        console.log('✅ Experimental migrations applied successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        // We don't throw here to avoid crashing the server if DB is temporarily locked or issues, 
        // but in prod we might want to be stricter.
    }
}

module.exports = { applyMigrations };
