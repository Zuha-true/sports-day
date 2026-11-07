const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const db = require('../database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

// Helper: get display name for an entity given game category
async function getEntityName(connection, entityId, category) {
  if (!entityId) return null;
  if (category === 'team') {
    const [[row]] = await connection.query('SELECT team_name FROM teams WHERE id = ?', [entityId]);
    return row?.team_name || null;
  }
  if (category === 'duo') {
    // Try team name first (created at registration time for new registrations)
    const [[teamRow]] = await connection.query(
      `SELECT t.team_name FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       JOIN registrations r ON r.user_id = tm.user_id AND r.id = ?
       LIMIT 1`,
      [entityId]
    );
    if (teamRow?.team_name) return teamRow.team_name;
    // Fallback: show both player names
    const [[row]] = await connection.query(
      `SELECT u.name AS captain, u2.name AS partner
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN registrations r2 ON r2.id = r.partner_reg_id
       LEFT JOIN users u2 ON u2.id = r2.user_id
       WHERE r.id = ?`,
      [entityId]
    );
    return row ? (row.partner ? `${row.captain} & ${row.partner}` : row.captain) : null;
  }
  // solo — entityId is a registration id; return user name
  const [[row]] = await connection.query(
    'SELECT u.name FROM registrations r JOIN users u ON u.id = r.user_id WHERE r.id = ?',
    [entityId]
  );
  return row?.name || null;
}

// Get bracket — admin sees all; student must be approved for the game
router.get('/:gameId', [param('gameId').isInt()], requireAuth, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    const { gameId } = req.params;

    // Visibility gate for students
    if (req.user.role === 'student') {
      const [check] = await db.query(
        `SELECT 1 FROM registrations WHERE user_id = ? AND game_id = ? AND status = 'approved' LIMIT 1`,
        [req.user.id, gameId]
      );
      // Also check team membership for team games
      const [teamCheck] = await db.query(
        `SELECT 1 FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.user_id = ? AND t.game_id = ? LIMIT 1`,
        [req.user.id, gameId]
      );
      if (!check.length && !teamCheck.length) {
        return res.status(403).json({ error: 'You must be an approved participant to view the bracket' });
      }
    }

    const [[game]] = await db.query('SELECT category FROM games WHERE id = ?', [gameId]);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const [matches] = await db.query(
      'SELECT * FROM matches WHERE game_id = ? ORDER BY round, match_number',
      [gameId]
    );

    // Attach display names
    const enriched = await Promise.all(matches.map(async m => ({
      ...m,
      entity1_name: await getEntityName(db, m.entity1_id, game.category),
      entity2_name: await getEntityName(db, m.entity2_id, game.category),
      winner_name:  await getEntityName(db, m.winner_id, game.category),
    })));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bracket' });
  }
});

// Generate bracket — admin only
router.post('/generate/:gameId', [param('gameId').isInt()], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid game ID' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { gameId } = req.params;

    const [[game]] = await connection.query('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });

    // Collect participants
    let entries;
    if (game.category === 'team') {
      const [teams] = await connection.query(
        'SELECT id FROM teams WHERE game_id = ? ORDER BY id', [gameId]
      );
      entries = teams.map(t => t.id);
    } else if (game.category === 'duo') {
      // Deduplicate pairs: both regs reference each other, so keep only the lower-ID one per pair.
      const [regs] = await connection.query(
        `SELECT r.id FROM registrations r
         WHERE r.game_id = ? AND r.status = 'approved'
         AND (r.partner_reg_id IS NULL OR r.id < r.partner_reg_id)
         ORDER BY r.id`,
        [gameId]
      );
      entries = regs.map(r => r.id);
    } else {
      // solo: all approved registrations
      const [regs] = await connection.query(
        `SELECT id FROM registrations WHERE game_id = ? AND status = 'approved' ORDER BY id`,
        [gameId]
      );
      entries = regs.map(r => r.id);
    }

    if (entries.length < 2) throw new Error('Need at least 2 participants to generate bracket');

    await connection.query('DELETE FROM matches WHERE game_id = ?', [gameId]);

    // Build round 1 with auto-advance byes
    for (let i = 0; i < entries.length; i += 2) {
      const e1 = entries[i];
      const e2 = entries[i + 1] ?? null;
      const isBye = e2 === null;

      await connection.query(
        `INSERT INTO matches (game_id, round, match_number, entity1_id, entity2_id, winner_id, is_completed, is_bye)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
        [gameId, Math.floor(i / 2) + 1, e1, e2, isBye ? e1 : null, isBye, isBye]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to generate bracket' });
  } finally {
    connection.release();
  }
});

// Set match winner — admin only
router.put('/match/:id', [
  param('id').isInt(),
  body('winner_id').isInt(),
], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { winner_id } = req.body;

    await connection.query(
      'UPDATE matches SET winner_id = ?, is_completed = TRUE WHERE id = ?',
      [winner_id, id]
    );

    const [[match]] = await connection.query('SELECT * FROM matches WHERE id = ?', [id]);

    // Check if entire round is now complete
    const [[{ total }]] = await connection.query(
      'SELECT COUNT(*) AS total FROM matches WHERE game_id = ? AND round = ?',
      [match.game_id, match.round]
    );
    const [[{ completed }]] = await connection.query(
      'SELECT COUNT(*) AS completed FROM matches WHERE game_id = ? AND round = ? AND is_completed = TRUE',
      [match.game_id, match.round]
    );

    // Generate next round if all current-round matches are done and there are multiple matches
    if (Number(completed) === Number(total) && Number(total) > 1) {
      const [winners] = await connection.query(
        'SELECT winner_id FROM matches WHERE game_id = ? AND round = ? ORDER BY match_number',
        [match.game_id, match.round]
      );

      const nextRound = match.round + 1;
      for (let i = 0; i < winners.length; i += 2) {
        const e1 = winners[i].winner_id;
        const e2 = winners[i + 1]?.winner_id ?? null;
        const isBye = e2 === null;

        await connection.query(
          `INSERT INTO matches (game_id, round, match_number, entity1_id, entity2_id, winner_id, is_completed, is_bye)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [match.game_id, nextRound, Math.floor(i / 2) + 1, e1, e2, isBye ? e1 : null, isBye, isBye]
        );
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update match' });
  } finally {
    connection.release();
  }
});

// Get champion for a game
router.get('/champion/:gameId', [param('gameId').isInt()], requireAuth, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    const { gameId } = req.params;
    const [[game]] = await db.query('SELECT category FROM games WHERE id = ?', [gameId]);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Find the final match (highest round, single match, completed)
    const [[finalMatch]] = await db.query(
      `SELECT * FROM matches
       WHERE game_id = ? AND is_completed = TRUE
       ORDER BY round DESC, match_number DESC
       LIMIT 1`,
      [gameId]
    );

    if (!finalMatch?.winner_id) return res.json({ champion: null });

    const name = await getEntityName(db, finalMatch.winner_id, game.category);
    res.json({ champion: name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch champion' });
  }
});

// Reset bracket — admin only
router.delete('/:gameId', [param('gameId').isInt()], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid game ID' });

  try {
    await db.query('DELETE FROM matches WHERE game_id = ?', [req.params.gameId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset bracket' });
  }
});

module.exports = router;
