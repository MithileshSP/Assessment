-- Migration: add checksum/category uniqueness and timestamps; drop legacy blob if present
ALTER TABLE assets
  DROP COLUMN IF EXISTS file_data,
  ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64) NULL AFTER size,
  ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE assets
  ADD UNIQUE INDEX IF NOT EXISTS idx_assets_checksum_category (checksum_sha256, category);
