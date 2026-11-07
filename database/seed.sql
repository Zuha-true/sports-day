-- Seed data — run AFTER schema.sql
-- Games, settings defaults. No user data.

INSERT INTO settings (`key`, value, updated_by) VALUES
  ('qr_url',      '',               'system'),
  ('upi_id',      'yourname@upi',   'system'),
  ('payee_name',  'AITM Sports Day','system')
ON DUPLICATE KEY UPDATE `key` = `key`;

INSERT INTO games (name, category, description, rules, entry_fee, is_active) VALUES
  -- Solos (3 placeholders — admin edits these once the final list is known)
  ('Solo Event 1', 'solo', 'Placeholder solo event. Admin: edit this from Manage Games.', NULL, 50.00, TRUE),
  ('Solo Event 2', 'solo', 'Placeholder solo event. Admin: edit this from Manage Games.', NULL, 50.00, TRUE),
  ('Solo Event 3', 'solo', 'Placeholder solo event. Admin: edit this from Manage Games.', NULL, 50.00, TRUE),
  -- Duos
  ('Badminton',    'duo',  'Doubles badminton', 'Standard doubles rules apply.', 50.00, TRUE),
  ('Chess',        'duo',  'Chess for pairs',   'FIDE standard rules.', 50.00, TRUE),
  -- Teams
  ('Kho-Kho',    'team', 'Traditional kho-kho team sport', NULL, 50.00, TRUE),
  ('Throwball',  'team', 'Throwball team sport',           NULL, 50.00, TRUE),
  ('Carrom',     'team', 'Carrom board game',              NULL, 50.00, TRUE),
  ('Ludo',       'team', 'Ludo board game',                NULL, 50.00, TRUE)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Set team sizes for team games
UPDATE games SET min_team_size = 9,  max_team_size = 12 WHERE name = 'Kho-Kho'   AND category = 'team';
UPDATE games SET min_team_size = 7,  max_team_size = 9  WHERE name = 'Throwball' AND category = 'team';
UPDATE games SET min_team_size = 2,  max_team_size = 2  WHERE name = 'Carrom'    AND category = 'team';
UPDATE games SET min_team_size = 1,  max_team_size = 4  WHERE name = 'Ludo'      AND category = 'team';
