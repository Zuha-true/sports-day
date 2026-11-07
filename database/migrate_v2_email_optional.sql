-- Migration: make users.email nullable and add departments table
-- Run in MySQL Workbench: open file, select all, run.

-- 1. Drop the NOT NULL constraint on users.email
--    and change the unique index to allow multiple NULLs.
--    MySQL UNIQUE indexes already allow multiple NULLs, so we just
--    make the column nullable.
ALTER TABLE users
  MODIFY COLUMN email VARCHAR(255) NULL DEFAULT NULL;

-- 2. Convert any empty-string emails already stored to NULL
UPDATE users SET email = NULL WHERE email = '' OR email = ' ';

-- 3. Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_dept_name (name)
);

-- 4. Seed departments
INSERT IGNORE INTO departments (name, active) VALUES
  ('Computer Science', TRUE),
  ('Electronics and Communication', TRUE),
  ('Mechanical', TRUE),
  ('Robotics', TRUE);

-- 5. (Optional) If you want to migrate existing free-text department values
--    to department IDs you would add a department_id column to users here.
--    For now the users.department column stays as free text (VARCHAR 100)
--    and the departments table is used only for the sign-up dropdown and
--    admin filter. You can do a full migration later.
SELECT 'Done.' AS status;
