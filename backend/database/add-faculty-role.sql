-- Migration to add 'faculty' role to users table
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'student', 'faculty') DEFAULT 'student';
