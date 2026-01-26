-- Migration: Add passing_threshold to courses table
-- This allows global control of auto-scoring thresholds at the course level

ALTER TABLE courses ADD COLUMN passing_threshold JSON AFTER tags;

-- Initialize with default values for existing courses
UPDATE courses SET passing_threshold = '{"structure": 80, "visual": 80, "overall": 75}' WHERE passing_threshold IS NULL;
