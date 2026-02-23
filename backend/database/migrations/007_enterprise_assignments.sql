-- Migration 007: Enterprise Assignment System (Robust & Idempotent)
-- Run: mysql -u root -p fullstack_test_portal < migrations/007_enterprise_assignments.sql

-- 1. Ensure submission_assignments exists
CREATE TABLE IF NOT EXISTS submission_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(100) NOT NULL,
    faculty_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'evaluated') DEFAULT 'pending',
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_submission_assignment (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Helpers for Idempotency
DELIMITER //

DROP PROCEDURE IF EXISTS AddCol //
CREATE PROCEDURE AddCol(
    IN tableName VARCHAR(64),
    IN colName VARCHAR(64),
    IN colDef TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = tableName AND column_name = colName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', colName, ' ', colDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DROP PROCEDURE IF EXISTS AddIndex //
CREATE PROCEDURE AddIndex(
    IN tableName VARCHAR(64),
    IN indexName VARCHAR(64),
    IN indexDef VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = tableName AND index_name = indexName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD INDEX ', indexName, ' ', indexDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- 3. Modify status safely
-- First, expand to VARCHAR to avoid truncation during transition
ALTER TABLE submission_assignments MODIFY COLUMN status VARCHAR(50);

-- 4. Migrate data
UPDATE submission_assignments SET status = 'assigned' WHERE status = 'pending';

-- 5. Set final ENUM
ALTER TABLE submission_assignments
  MODIFY COLUMN status ENUM('unassigned','assigned','in_progress','evaluated','reallocated','reopened') DEFAULT 'assigned';

-- 5. Add columns safely
CALL AddCol('submission_assignments', 'version', 'INT NOT NULL DEFAULT 1');
CALL AddCol('submission_assignments', 'locked_by', 'VARCHAR(100) NULL');
CALL AddCol('submission_assignments', 'locked_at', 'TIMESTAMP NULL');
CALL AddCol('submission_assignments', 'reallocation_count', 'INT NOT NULL DEFAULT 0');
CALL AddCol('submission_assignments', 'last_reallocated_at', 'TIMESTAMP NULL');
CALL AddCol('submission_assignments', 'submission_weight', 'INT NOT NULL DEFAULT 1');

-- 6. Add indexes safely
CALL AddIndex('submission_assignments', 'idx_sa_status', '(status)');
CALL AddIndex('submission_assignments', 'idx_sa_faculty_status', '(faculty_id, status)');
CALL AddIndex('submission_assignments', 'idx_sa_faculty', '(faculty_id)');

-- 7. Extend Users table
CALL AddCol('users', 'is_available', 'BOOLEAN DEFAULT TRUE');
CALL AddCol('users', 'max_capacity', 'INT DEFAULT 10');
CALL AddCol('users', 'current_load', 'INT DEFAULT 0');

-- 8. Assignment Logs
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

-- 8b. Add IDEMPOTENT columns to assignment_logs (in case table existed but was incomplete)
CALL AddCol('assignment_logs', 'from_faculty_id', 'VARCHAR(100) NULL');
CALL AddCol('assignment_logs', 'to_faculty_id', 'VARCHAR(100) NULL');
CALL AddCol('assignment_logs', 'admin_id', 'VARCHAR(100) NULL');
CALL AddCol('assignment_logs', 'actor_role', 'VARCHAR(20) DEFAULT "system"');
CALL AddCol('assignment_logs', 'notes', 'TEXT');
CALL AddCol('assignment_logs', 'metadata', 'JSON NULL');

-- 9. Add exported_at to submissions
CALL AddCol('submissions', 'exported_at', 'TIMESTAMP NULL');

-- Cleanup
DROP PROCEDURE AddCol;
DROP PROCEDURE AddIndex;
