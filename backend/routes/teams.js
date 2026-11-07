const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Get all teams for a game
router.get('/:gameId', [param('gameId').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    const { gameId } = req.params;
    const [teams] = await db.query(
      `SELECT t.*,
         GROUP_CONCAT(CONCAT(u.name, '\x1f', u.id) ORDER BY u.name SEPARATOR '\x1e') AS members
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN users u         ON u.id = tm.user_id
       WHERE t.game_id = ?
       GROUP BY t.id
       ORDER BY t.created_at`,
      [gameId]
    );

    const result = teams.map(team => ({
      ...team,
      members: team.members
        ? team.members.split('\x1e').map(m => {
            const [name, id] = m.split('\x1f');
            return { id: parseInt(id), name };
          })
        : []
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create team
router.post('/', [
  body('game_id').isInt(),
  body('team_name').trim().notEmpty().isLength({ max: 100 }),
  body('members').isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { game_id, team_name, members } = req.body;

    // Lock check for duplicate assignment
    if (members.length > 0) {
      const [existing] = await connection.query(
        `SELECT tm.user_id FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.user_id IN (?) AND t.game_id = ? FOR UPDATE`,
        [members, game_id]
      );
      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'One or more members are already on a team for this game' });
      }
    }

    const [exists] = await connection.query(
      'SELECT id FROM teams WHERE team_name = ? AND game_id = ? FOR UPDATE',
      [team_name, game_id]
    );
    if (exists.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'Team name already exists for this game' });
    }

    const [teamResult] = await connection.query(
      'INSERT INTO teams (game_id, team_name) VALUES (?, ?)',
      [game_id, team_name]
    );
    const teamId = teamResult.insertId;

    if (members.length > 0) {
      await connection.query(
        'INSERT INTO team_members (team_id, user_id) VALUES ?',
        [members.map(uid => [teamId, uid])]
      );
    }

    await connection.commit();
    res.status(201).json({ success: true, id: teamId });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Conflict: member already assigned or team name exists' });
    }
    if (err.code === 'ER_LOCK_WAIT_TIMEOUT') {
      return res.status(503).json({ error: 'Server busy, please retry' });
    }
    res.status(500).json({ error: 'Failed to create team' });
  } finally {
    connection.release();
  }
});

// Update team
router.put('/:id', [
  param('id').isInt(),
  body('team_name').trim().notEmpty().isLength({ max: 100 }),
  body('members').isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { team_name, members } = req.body;

    await connection.query('UPDATE teams SET team_name = ? WHERE id = ?', [team_name, id]);
    await connection.query('DELETE FROM team_members WHERE team_id = ?', [id]);

    if (members.length > 0) {
      await connection.query(
        'INSERT INTO team_members (team_id, user_id) VALUES ?',
        [members.map(uid => [id, uid])]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update team' });
  } finally {
    connection.release();
  }
});

// Delete team — blocked if active matches exist
router.delete('/:id', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { id } = req.params;
    const [matches] = await db.query(
      `SELECT id FROM matches
       WHERE (entity1_id = ? OR entity2_id = ?) AND is_completed = FALSE
       LIMIT 1`,
      [id, id]
    );
    if (matches.length > 0) {
      return res.status(422).json({ error: 'Cannot delete a team with active bracket matches' });
    }
    await db.query('DELETE FROM teams WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;
