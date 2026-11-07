-- Girls' Sports Day — clean-install schema
-- Run this on a fresh database: mysql -u root -p college_sports_day < schema.sql
-- To apply to an existing database with old data, run migrate_v1_to_v2.sql instead.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS departments;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  roll_number   VARCHAR(50)   NOT NULL UNIQUE,
  email         VARCHAR(255)  NULL UNIQUE,
  phone         VARCHAR(15)   NOT NULL,
  department    VARCHAR(100)  NOT NULL,
  year          TINYINT UNSIGNED NOT NULL COMMENT '1-4',
  password_hash VARCHAR(255),                    -- NULL for admin-created accounts
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name  (name),
  INDEX idx_phone (phone)
);

-- ─── games ────────────────────────────────────────────────────────────────────
CREATE TABLE games (
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
  max_participants     INT,         -- cap on registrations (teams for team games)
  min_team_size        TINYINT,
  max_team_size        TINYINT,
  substitutes_allowed  TINYINT UNSIGNED DEFAULT 0,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  image_url            VARCHAR(500),
  created_at           TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_game_name_cat (name, category),
  INDEX idx_category   (category),
  INDEX idx_active     (is_active)
);

-- ─── registrations ────────────────────────────────────────────────────────────
-- One row per student per game. For team games, only the captain registers.
-- fee_paid = declared_player_count × entry_fee for team captains, else entry_fee.
CREATE TABLE registrations (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  user_id               INT          NOT NULL,
  game_id               INT          NOT NULL,
  status                ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  fee_paid              DECIMAL(8,2) NOT NULL,
  utr                   VARCHAR(100),
  screenshot_url        VARCHAR(500),
  payment_method        ENUM('upi','cash','other') NOT NULL DEFAULT 'upi',
  partner_reg_id        INT,                       -- duo: FK to partner's registration
  is_captain            BOOLEAN      NOT NULL DEFAULT FALSE,
  declared_player_count TINYINT UNSIGNED,          -- team captain only
  rejected_reason       VARCHAR(500),
  approved_by           VARCHAR(100),              -- 'admin' or display name
  approved_at           TIMESTAMP,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_game (user_id, game_id),
  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
  FOREIGN KEY (game_id)         REFERENCES games(id)         ON DELETE RESTRICT,
  FOREIGN KEY (partner_reg_id)  REFERENCES registrations(id) ON DELETE SET NULL,
  INDEX idx_status          (status),
  INDEX idx_game_status     (game_id, status),
  INDEX idx_user_id         (user_id)
);

-- ─── teams ────────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  game_id     INT          NOT NULL,
  team_name   VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY  uq_team_game (game_id, team_name),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE RESTRICT
);

-- ─── team_members ─────────────────────────────────────────────────────────────
CREATE TABLE team_members (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  team_id       INT     NOT NULL,
  user_id       INT     NOT NULL,
  is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_team_user (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id)  ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE RESTRICT
);

-- ─── matches ──────────────────────────────────────────────────────────────────
-- entity1_id / entity2_id are teams.id for team games, registrations.id for solo/duo.
-- Caller derives which table to join from game.category.
CREATE TABLE matches (
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

-- ─── settings ─────────────────────────────────────────────────────────────────
CREATE TABLE settings (
  `key`      VARCHAR(50)   PRIMARY KEY,
  value      MEDIUMTEXT,
  updated_by VARCHAR(100)  DEFAULT 'system',
  updated_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── departments ─────────────────────────────────────────────────────────────
CREATE TABLE departments (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_dept_name (name)
);

INSERT INTO departments (name) VALUES
  ('Computer Science'),
  ('Electronics and Communication'),
  ('Mechanical'),
  ('Robotics');

-- ─── audit_log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
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
