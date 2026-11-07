// Students route — now only used by admin for quick lookup.
// Main user management is under /api/admin/users.
const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Get all users (students)
router.get('/', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, roll_number, email, phone, department, year, is_active, created_at FROM users ORDER BY name'
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get users eligible for a team game (approved for the game but not yet assigned to a team)
router.get('/eligible/:gameId', [
  param('gameId').isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    const { gameId } = req.params;
    const [users] = await db.query(
      `SELECT u.id, u.name, u.roll_number
       FROM users u
       JOIN registrations r ON r.user_id = u.id
       WHERE r.game_id = ? AND r.status = 'approved'
         AND u.id NOT IN (
           SELECT tm.user_id FROM team_members tm
           JOIN teams t ON tm.team_id = t.id WHERE t.game_id = ?
         )
       ORDER BY u.name`,
      [gameId, gameId]
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch eligible users' });
  }
});

module.exports = router;
