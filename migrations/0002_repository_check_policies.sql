-- Existing repositories default to an empty policy (unknown, never green).
ALTER TABLE repositories ADD COLUMN required_checks TEXT NOT NULL DEFAULT '[]';
