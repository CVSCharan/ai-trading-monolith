-- Migration: 0001_add_user_role
-- Adds role column to user_profiles table
-- Run: psql $DATABASE_URL -f 0001_add_user_role.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'DEMO');
  END IF;
END$$;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'SUPER_ADMIN';

-- Back-fill any existing rows
UPDATE user_profiles SET role = 'SUPER_ADMIN' WHERE role IS NULL OR role = '';

COMMENT ON COLUMN user_profiles.role IS 'SUPER_ADMIN: full access; DEMO: read-only showcase';
