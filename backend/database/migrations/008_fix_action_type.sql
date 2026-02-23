-- Migration 008: Fix action_type column truncation
-- Date: 2026-02-19

-- Change action_type from ENUM to VARCHAR(50) to support 'bulk_assign' and other future types
ALTER TABLE assignment_logs MODIFY COLUMN action_type VARCHAR(50) NOT NULL;
