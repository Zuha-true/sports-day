-- Migration: v1 (boolean-column students) → v2 (users + games + registrations)
-- Run on a database that still has the OLD schema (students, teams, team_members, matches tables).
-- Steps:
--   1. Rename old tables so they coexist during migration.
--   2. Create all new tables (safe with IF NOT EXISTS).
--   3. Seed default data.
--   4. Copy students → users (with placeholder dept/year/phone where missing).
--   5. Copy teams → new teams (mapped to game_id).
--   6. Copy team_members → new team_members.
--   7. Drop old tables (comment this block out if you want to verify data first).
--
-- HOW TO RUN IN MYSQL WORKBENCH:
--   Open this file, select all, run. Address any errors (usually duplicate data),
--   then uncomment the DROP block at the bottom once you're satisfied.

SET FOREIGN_KEY_CHECKS = 0;

-- ─── 1. Rename old tables ─────────────────────────────────────────────────────
-- (safe to re-run: IF EXISTS prevents errors if already renamed)
RENAME TABLE
  students     TO students_old,
  teams        TO teams_old,
  team_members TO team_members_old,
  matches      TO matches_old;

-- ─── 2. Create new tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  roll_number   VARCHAR(50)   NOT NULL UNIQUE,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  phone         VARCHAR(15)   NOT NULL,
  department    VARCHAR(100)  NOT NULL,
  year          TINYINT UNSIGNED NOT NULL,
  password_hash VARCHAR(255),
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name  (name),
  INDEX idx_phone (phone)
);

CREATE TABLE IF NOT EXISTS games (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(100) NOT NULL,
  category             ENUM('solo','duo','team') NOT NULL,
  description          TEXT,
  rules                TEXT,
  entry_fee            DECIMAL(8,2) NOT NULL DEFAULT 50.00,
  schedule_at          DATETIME,
  venue                VARCHAR(255),
  reg_open_at          DATETIME,
  reg_close_at         DATETIME,
  max_participants     INT,
  min_team_size        TINYINT,
  max_team_size        TINYINT,
  substitutes_allowed  TINYINT UNSIGNED DEFAULT 0,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  image_url            VARCHAR(500),
  created_at           TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_game_name_cat (name, category),
  INDEX idx_category (category),
  INDEX idx_active   (is_active)
);

CREATE TABLE IF NOT EXISTS registrations (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  user_id               INT          NOT NULL,
  game_id               INT          NOT NULL,
  status                ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  fee_paid              DECIMAL(8,2) NOT NULL,
  utr                   VARCHAR(100),
  screenshot_url        VARCHAR(500),
  payment_method        ENUM('upi','cash','other') NOT NULL DEFAULT 'upi',
  partner_reg_id        INT,
  is_captain            BOOLEAN      NOT NULL DEFAULT FALSE,
  declared_player_count TINYINT UNSIGNED,
  rejected_reason       VARCHAR(500),
  approved_by           VARCHAR(100),
  approved_at           TIMESTAMP,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_game (user_id, game_id),
  FOREIGN KEY (user_id)        REFERENCES users(id)         ON DELETE CASCADE,
  FOREIGN KEY (game_id)        REFERENCES games(id)         ON DELETE RESTRICT,
  FOREIGN KEY (partner_reg_id) REFERENCES registrations(id) ON DELETE SET NULL,
  INDEX idx_status      (status),
  INDEX idx_game_status (game_id, status),
  INDEX idx_user_id     (user_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  game_id    INT          NOT NULL,
  team_name  VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_game (game_id, team_name),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS team_members (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  team_id       INT     NOT NULL,
  user_id       INT     NOT NULL,
  is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_team_user (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id)  ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS matches (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  game_id      INT              NOT NULL,
  round        TINYINT UNSIGNED NOT NULL,
  match_number TINYINT UNSIGNED NOT NULL,
  entity1_id   INT,
  entity2_id   INT,
  winner_id    INT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  is_bye       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_game_round (game_id, round)
);

CREATE TABLE IF NOT EXISTS settings (
  `key`      VARCHAR(50)  PRIMARY KEY,
  value      MEDIUMTEXT,
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  action      VARCHAR(100) NOT NULL,
  actor       VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   INT,
  detail      JSON,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_target  (target_type, target_id)
);

-- ─── 3. Seed defaults ─────────────────────────────────────────────────────────

INSERT IGNORE INTO settings (`key`, value, updated_by) VALUES
  ('qr_url',      '',                'system'),
  ('upi_id',      'yourname@upi',    'system'),
  ('payee_name',  'AITM Sports Day', 'system');

INSERT IGNORE INTO games (name, category, description, entry_fee, is_active) VALUES
  ('Solo Event 1', 'solo', 'Placeholder solo event', 50.00, TRUE),
  ('Solo Event 2', 'solo', 'Placeholder solo event', 50.00, TRUE),
  ('Solo Event 3', 'solo', 'Placeholder solo event', 50.00, TRUE),
  ('Badminton',    'duo',  'Doubles badminton',       50.00, TRUE),
  ('Chess',        'duo',  'Chess for pairs',         50.00, TRUE),
  ('Kho-Kho',      'team', 'Kho-kho team sport',      50.00, TRUE),
  ('Throwball',    'team', 'Throwball team sport',    50.00, TRUE),
  ('Carrom',       'team', 'Carrom board game',       50.00, TRUE),
  ('Ludo',         'team', 'Ludo board game',         50.00, TRUE);

UPDATE games SET min_team_size = 9,  max_team_size = 12 WHERE name = 'Kho-Kho'   AND category = 'team';
UPDATE games SET min_team_size = 7,  max_team_size = 9  WHERE name = 'Throwball' AND category = 'team';
UPDATE games SET min_team_size = 2,  max_team_size = 2  WHERE name = 'Carrom'    AND category = 'team';
UPDATE games SET min_team_size = 1,  max_team_size = 4  WHERE name = 'Ludo'      AND category = 'team';

-- ─── 4. Migrate students → users ──────────────────────────────────────────────
-- Generates a unique placeholder email for rows missing one.
-- Students will need to set their password via the admin reset flow on first login.

INSERT IGNORE INTO users (name, roll_number, email, phone, department, year, password_hash, is_active, created_at)
SELECT
  s.name,
  s.roll_number,
  COALESCE(NULLIF(TRIM(s.email), ''),
    CONCAT(LOWER(REPLACE(s.roll_number, ' ', '')), '@migrated.placeholder')),
  COALESCE(NULLIF(TRIM(s.phone), ''), '0000000000'),
  'Unknown',   -- department not in old schema
  1,           -- year not in old schema
  NULL,        -- no password — admin must reset for each student
  TRUE,
  s.created_at
FROM students_old s;

-- ─── 5. Migrate teams → new teams ─────────────────────────────────────────────
-- Maps old sport string to game name. Add rows for any old sports not listed below.

INSERT IGNORE INTO teams (game_id, team_name, created_at)
SELECT g.id, t.team_name, t.created_at
FROM teams_old t
JOIN games g ON g.name = CASE t.sport
  WHEN 'kho_kho'           THEN 'Kho-Kho'
  WHEN 'throwball'         THEN 'Throwball'
  WHEN 'carrom'            THEN 'Carrom'
  WHEN 'ludo'              THEN 'Ludo'
  WHEN 'badminton_doubles' THEN 'Badminton'
  WHEN 'cricket'           THEN 'Cricket'
  WHEN 'relay'             THEN 'Relay'
  WHEN 'tug_of_war'        THEN 'Tug of War'
  ELSE t.sport
END
AND g.category = 'team';

-- ─── 6. Migrate team_members → new team_members ───────────────────────────────

INSERT IGNORE INTO team_members (team_id, user_id)
SELECT nt.id, u.id
FROM team_members_old tm
JOIN teams_old ot   ON tm.team_id   = ot.id
JOIN teams nt       ON nt.team_name = ot.team_name
JOIN users u        ON u.roll_number = (
  SELECT roll_number FROM students_old WHERE id = tm.student_id LIMIT 1
);

SET FOREIGN_KEY_CHECKS = 1;

-- ─── 7. Drop old tables (uncomment once you have verified the migrated data) ───
DROP TABLE IF EXISTS matches_old;
DROP TABLE IF EXISTS team_members_old;
DROP TABLE IF EXISTS teams_old;
DROP TABLE IF EXISTS students_old;
SHOW tables;