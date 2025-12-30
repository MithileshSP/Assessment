-- Optional helper: ensure mime/type columns wide enough; no functional change
ALTER TABLE assets MODIFY type VARCHAR(150);
