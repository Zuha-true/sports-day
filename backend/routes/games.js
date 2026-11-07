const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../database');
const { requireAdmin, requireStudent } = require('../middleware/auth');

const commonValidation = [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('category').isIn(['solo', 'duo', 'team']),
  body('description').optional().trim(),
  body('rules').optional().trim(),
  body('entry_fee').isFloat({ min: 0 }),
  body('schedule_at').optional({ nullable: true }).isISO8601(),
  body('venue').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('reg_open_at').optional({ nullable: true }).isISO8601(),
  body('reg_close_at').optional({ nullable: true }).isISO8601(),
  body('max_participants').optional({ nullable: true }).isInt({ min: 1 }),
  body('is_active').optional().isBoolean(),
  body('image_url').optional({ nullable: true }).trim().isURL(),
];

function validateCategory(req, res, next) {
  const { category, min_team_size, max_team_size } = req.body;
  if (category === 'team') {
    if (!min_team_size || !max_team_size) {
      return res.status(400).json({ error: 'Team games require min_team_size and max_team_size' });
    }
    if (parseInt(max_team_size) < parseInt(min_team_size)) {
      return res.status(400).json({ error: 'max_team_size must be >= min_team_size' });
    }
  }
  next();
}

// List games — admin sees all, student sees active only
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.headers.authorization
      ? (() => {
          try {
            const jwt = require('jsonwebtoken');
            const t = req.headers.authorization.split(' ')[1];
            return jwt.verify(t, process.env.JWT_SECRET)?.role === 'admin';
          } catch { return false; }
        })()
      : false;

    const whereClause = isAdmin ? '' : 'WHERE is_active = TRUE';

    const [games] = await db.query(
      `SELECT g.*,
         (SELECT COUNT(*) FROM registrations r WHERE r.game_id = g.id) AS registration_count,
         (SELECT COUNT(*) FROM registrations r WHERE r.game_id = g.id AND r.status = 'approved') AS approved_count
       FROM games g ${whereClause}
       ORDER BY category, name`
    );
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get single game
router.get('/:id', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const [[game]] = await db.query('SELECT * FROM games WHERE id = ?', [req.params.id]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Create game — admin only
router.post('/', requireAdmin, commonValidation, validateCategory, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const {
      name, category, description, rules, entry_fee = 50,
      schedule_at, venue, reg_open_at, reg_close_at,
      max_participants, min_team_size, max_team_size,
      substitutes_allowed = 0, is_active = true, image_url,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO games
         (name, category, description, rules, entry_fee, schedule_at, venue,
          reg_open_at, reg_close_at, max_participants, min_team_size,
          max_team_size, substitutes_allowed, is_active, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, description || null, rules || null, entry_fee,
       schedule_at || null, venue || null, reg_open_at || null, reg_close_at || null,
       max_participants || null, min_team_size || null, max_team_size || null,
       substitutes_allowed, is_active, image_url || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A game with this name already exists in this category' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Update game — admin only. Fee changes do NOT touch existing registrations.
router.put('/:id', requireAdmin, [param('id').isInt()], commonValidation, validateCategory, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const { id } = req.params;
    const {
      name, category, description, rules, entry_fee,
      schedule_at, venue, reg_open_at, reg_close_at,
      max_participants, min_team_size, max_team_size,
      substitutes_allowed, is_active, image_url,
    } = req.body;

    const [result] = await db.query(
      `UPDATE games SET
         name = ?, category = ?, description = ?, rules = ?, entry_fee = ?,
         schedule_at = ?, venue = ?, reg_open_at = ?, reg_close_at = ?,
         max_participants = ?, min_team_size = ?, max_team_size = ?,
         substitutes_allowed = ?, is_active = ?, image_url = ?
       WHERE id = ?`,
      [name, category, description || null, rules || null, entry_fee,
       schedule_at || null, venue || null, reg_open_at || null, reg_close_at || null,
       max_participants || null, min_team_size || null, max_team_size || null,
       substitutes_allowed ?? 0, is_active ?? true, image_url || null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Game not found' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Name already taken in this category' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Toggle active — admin only
router.patch('/:id/toggle', [param('id').isInt()], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    await db.query('UPDATE games SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle game' });
  }
});

// Delete game — admin only, only if zero registrations
router.delete('/:id', [param('id').isInt()], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { id } = req.params;
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM registrations WHERE game_id = ?', [id]
    );
    if (Number(count) > 0) {
      return res.status(422).json({
        error: 'This game has registrations and cannot be deleted. Deactivate it instead.'
      });
    }
    await db.query('DELETE FROM games WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Approved participants (names only) — approved students for this game only
router.get('/:id/participants', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { id } = req.params;

    // Verify requester is approved for this game (or admin)
    const jwt = require('jsonwebtoken');
    let isAdmin = false;
    let userId = null;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        isAdmin = decoded.role === 'admin';
        userId = decoded.id;
      }
    } catch { /* unauthenticated — rejected below */ }

    if (!isAdmin) {
      if (!userId) return res.status(401).json({ error: 'Login required' });
      const [check] = await db.query(
        `SELECT 1 FROM registrations WHERE user_id = ? AND game_id = ? AND status = 'approved'
         UNION SELECT 1 FROM team_members tm JOIN teams t ON tm.team_id = t.id
           WHERE tm.user_id = ? AND t.game_id = ?
         LIMIT 1`,
        [userId, id, userId, id]
      );
      if (!check.length) {
        return res.status(403).json({ error: 'You must be an approved participant to view this' });
      }
    }

    const [[game]] = await db.query('SELECT category FROM games WHERE id = ?', [id]);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    let participants;
    if (game.category === 'team') {
      const [rows] = await db.query(
        `SELECT t.team_name, u.name AS member_name
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         JOIN users u ON u.id = tm.user_id
         WHERE t.game_id = ?
         ORDER BY t.team_name, u.name`,
        [id]
      );
      // Group by team
      const teams = {};
      rows.forEach(r => {
        if (!teams[r.team_name]) teams[r.team_name] = [];
        teams[r.team_name].push(r.member_name);
      });
      participants = Object.entries(teams).map(([team, members]) => ({ team, members }));
    } else {
      const [rows] = await db.query(
        `SELECT u.name FROM registrations r
         JOIN users u ON u.id = r.user_id
         WHERE r.game_id = ? AND r.status = 'approved'
         ORDER BY u.name`,
        [id]
      );
      participants = rows.map(r => r.name);
    }

    res.json({ participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

module.exports = router;
