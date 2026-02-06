-- Migration v3.5.0: Remove legacy course fields
-- This script drops the icon, color, and difficulty columns which are no longer used.

USE fullstack_test_portal;

-- Step 1: Drop the index on difficulty
DROP INDEX idx_difficulty ON courses;

-- Step 2: Drop the legacy columns
ALTER TABLE courses 
DROP COLUMN icon,
DROP COLUMN color,
DROP COLUMN difficulty;
