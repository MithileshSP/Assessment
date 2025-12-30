-- Migration: normalize assets table for filesystem storage only
-- - drop BLOB column
-- - add checksum and metadata helpers

ALTER TABLE assets
  DROP COLUMN IF EXISTS file_data,
  ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64) NULL AFTER size,
  ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Optional: ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets (category);
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_at ON assets (uploaded_at);
