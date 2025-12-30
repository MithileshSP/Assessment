-- Import Users
INSERT INTO users (id, username, password, email, full_name, role, created_at) VALUES
('user-001', 'admin', '123456', 'admin@example.com', 'Administrator', 'admin', NOW()),
('user-002', 'student1', '123456', 'student1@example.com', 'Student One', 'student', NOW()),
('user-003', 'testuser1', '123456', 'testuser1@example.com', 'Test User', 'student', NOW()),
('user-004', 'gokul', '123456', 'gokul@example.com', 'Gokul', 'admin', NOW())
ON DUPLICATE KEY UPDATE username=username;

-- Import Courses
INSERT INTO courses (id, title, description, thumbnail, icon, color, total_levels, estimated_time, difficulty, tags, is_locked) VALUES
('html-css', 'HTML & CSS Fundamentals', 'Master the building blocks of web development', '/thumbnails/html-css.jpg', 'Code', 'blue', 6, '2 hours', 'Beginner', '["html", "css", "fundamentals"]', 0),
('javascript', 'JavaScript Basics', 'Learn JavaScript programming essentials', '/thumbnails/javascript.jpg', 'Code', 'yellow', 6, '3 hours', 'Intermediate', '["javascript", "programming"]', 0),
('responsive', 'Responsive Design', 'Create mobile-friendly websites', '/thumbnails/responsive.jpg', 'Layout', 'green', 6, '2 hours', 'Intermediate', '["responsive", "css", "design"]', 0),
('full-stack', 'Full Stack Projects', 'Build complete web applications', '/thumbnails/full-stack.jpg', 'Zap', 'purple', 6, '4 hours', 'Advanced', '["full-stack", "projects"]', 0)
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- Import Challenges (30 questions - 5 per level × 6 levels)
-- Level 1 - HTML & CSS
-- Challenge seeds removed (schema mismatch with expected columns). Add challenge seed aligned to current schema if needed.

SELECT 'Data import completed!' as message;
