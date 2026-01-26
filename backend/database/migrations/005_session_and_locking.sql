-- Migration: Add session enforcement and violation locking columns
-- Date: 2026-01-23

-- 1. Add current_session_id to users table for single-session enforcement
ALTER TABLE users ADD COLUMN current_session_id VARCHAR(100) NULL;
ALTER TABLE users ADD INDEX idx_session_id (current_session_id);

-- 2. Add locked column to test_attendance for violation locking
ALTER TABLE test_attendance ADD COLUMN locked BOOLEAN DEFAULT FALSE;
ALTER TABLE test_attendance ADD COLUMN locked_at TIMESTAMP NULL;
ALTER TABLE test_attendance ADD COLUMN locked_reason VARCHAR(255) NULL;
ALTER TABLE test_attendance ADD COLUMN violation_count INT DEFAULT 0;
