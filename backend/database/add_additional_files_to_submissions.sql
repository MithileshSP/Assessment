-- Add additional_files column to submissions table
ALTER TABLE submissions ADD COLUMN additional_files JSON DEFAULT (JSON_OBJECT());
