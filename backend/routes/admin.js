const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// ─── All Users (search + filter + pagination) ─────────────────────────────────
router.get('/users', [
  query('q').optional().trim().isLength({ max: 200 }),
  query('game_id').optional().isInt(),
  query('category').optional().isIn(['solo','duo','team']),
  query('status').optional().isIn(['pending','approved','rejected']),
  query('department').optional().trim().isLength({ max: 100 }),
  query('year').optional().isInt({ min: 1, max: 4 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid query parameters' });

  try {
    const {
      q, game_id, category, status, department, year,
      page = 1, limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (q) {
      const like = `%${q}%`;
      conditions.push(`(u.name LIKE ? OR u.roll_number LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`);
      params.push(like, like, like, like);
    }
    if (department) { conditions.push('u.department = ?'); params.push(department); }
    if (year)       { conditions.push('u.year = ?');       params.push(year); }

    // Filter by game/category/status requires joining registrations
    let joinClause = '';
    if (game_id || category || status || q) {
      // If filtering by game-related fields, include users who have matching registrations
      // (or include all users and show counts — simpler: filter at user level)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [users] = await db.query(
      `SELECT u.id, u.name, u.roll_number, u.department, u.year, u.email, u.phone,
              u.is_active, u.created_at,
              COUNT(DISTINCT r.id) AS registration_count
       FROM users u
       LEFT JOIN registrations r ON r.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.name
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params
    );

    // Attach game summary badges
    const userIds = users.map(u => u.id);
    let gameBadges = {};
    if (userIds.length > 0) {
      const [badges] = await db.query(
        `SELECT r.user_id, g.name AS game_name, g.category, r.status
         FROM registrations r JOIN games g ON g.id = r.game_id
         WHERE r.user_id IN (?)
         ORDER BY g.name`,
        [userIds]
      );
      badges.forEach(b => {
        if (!gameBadges[b.user_id]) gameBadges[b.user_id] = [];
        gameBadges[b.user_id].push({ game: b.game_name, category: b.category, status: b.status });
      });
    }

    const result = users.map(u => ({ ...u, games: gameBadges[u.id] || [] }));
    res.json({ users: result, total: Number(total), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// User detail with full history
router.get('/users/:id', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { id } = req.params;
    const [[user]] = await db.query(
      `SELECT id, name, roll_number, email, phone, department, year, is_active, created_at
       FROM users WHERE id = ?`, [id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [regs] = await db.query(
      `SELECT r.*, g.name AS game_name, g.category
       FROM registrations r JOIN games g ON g.id = r.game_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`, [id]
    );

    const [teams] = await db.query(
      `SELECT t.team_name, g.name AS game_name, g.category
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN games g ON g.id = t.game_id
       WHERE tm.user_id = ?`, [id]
    );

    res.json({ ...user, registrations: regs, teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Delete user (removes team memberships first, then cascades registrations)
router.delete('/users/:id', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [[user]] = await connection.query('SELECT id, name FROM users WHERE id = ?', [id]);
    if (!user) { await connection.rollback(); return res.status(404).json({ error: 'User not found' }); }

    // Remove from teams (RESTRICT FK blocks user delete otherwise)
    await connection.query('DELETE FROM team_members WHERE user_id = ?', [id]);
    // Delete any teams that are now empty
    await connection.query(
      'DELETE FROM teams WHERE id NOT IN (SELECT DISTINCT team_id FROM team_members)'
    );
    // Delete user — registrations cascade via FK
    await connection.query('DELETE FROM users WHERE id = ?', [id]);

    await connection.query(
      "INSERT INTO audit_log (action, actor, target_type, target_id, detail) VALUES ('user_deleted','admin','user',?,?)",
      [id, JSON.stringify({ name: user.name })]
    );

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    connection.release();
  }
});

// Edit user (non-identity fields only)
router.patch('/users/:id', [
  param('id').isInt(),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('phone').optional().trim().matches(/^\d{10}$/),
  body('department').optional().trim().notEmpty().isLength({ max: 100 }),
  body('year').optional().isInt({ min: 1, max: 4 }),
  body('is_active').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

  try {
    const { id } = req.params;
    const { name, phone, department, year, is_active } = req.body;
    const fields = [];
    const params = [];
    if (name       !== undefined) { fields.push('name = ?');       params.push(name); }
    if (phone      !== undefined) { fields.push('phone = ?');      params.push(phone); }
    if (department !== undefined) { fields.push('department = ?'); params.push(department); }
    if (year       !== undefined) { fields.push('year = ?');       params.push(year); }
    if (is_active  !== undefined) { fields.push('is_active = ?');  params.push(is_active); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    await db.query(
      "INSERT INTO audit_log (action, actor, target_type, target_id, detail) VALUES ('user_edited','admin','user',?,?)",
      [id, JSON.stringify({ fields: Object.fromEntries(fields.map((f, i) => [f.split(' ')[0], params[i]])) })]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Reset password — returns temp password (admin gives it to student)
router.post('/users/:id/reset-password', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { id } = req.params;
    const tempPassword = crypto.randomBytes(6).toString('hex'); // 12-char hex
    const hash = await bcrypt.hash(tempPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    await db.query(
      "INSERT INTO audit_log (action, actor, target_type, target_id) VALUES ('password_reset','admin','user',?)", [id]
    );
    res.json({ success: true, temp_password: tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Manual registration (admin creates approved registration on behalf of student)
router.post('/manual-registration', [
  body('game_id').isInt(),
  body('payment_method').isIn(['upi','cash','other']),
  body('utr').optional().trim().isLength({ max: 100 }),
  body('user_id').optional().isInt(),
  body('user_data.name').optional().trim().notEmpty(),
  body('user_data.roll_number').optional().trim().notEmpty(),
  body('user_data.email').optional().isEmail(),
  body('user_data.phone').optional().trim().matches(/^\d{10}$/),
  body('user_data.department').optional().trim().notEmpty(),
  body('user_data.year').optional().isInt({ min: 1, max: 4 }),
  body('team_name').optional().trim().isLength({ max: 100 }),
  body('partner_roll').optional().trim(),
  body('member_rolls').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { game_id, payment_method, utr, team_name, partner_roll, member_rolls } = req.body;
    let userId = req.body.user_id;

    // Resolve or create captain
    if (!userId) {
      const { user_data } = req.body;
      if (!user_data?.name || !user_data?.roll_number) {
        await connection.rollback();
        return res.status(400).json({ error: 'Provide either user_id or complete user_data' });
      }
      const [result] = await connection.query(
        `INSERT INTO users (name, roll_number, email, phone, department, year, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [user_data.name, user_data.roll_number.toUpperCase(), user_data.email,
         user_data.phone || '0000000000', user_data.department || 'Unknown', user_data.year || 1]
      );
      userId = result.insertId;
    }

    const [[game]] = await connection.query(
      'SELECT entry_fee, category, min_team_size, max_team_size FROM games WHERE id = ?', [game_id]
    );
    if (!game) { await connection.rollback(); return res.status(404).json({ error: 'Game not found' }); }

    if ((game.category === 'duo' || game.category === 'team') && !team_name) {
      await connection.rollback();
      return res.status(400).json({ error: 'Team name is required for duo/team games' });
    }

    // Create captain registration
    const [regResult] = await connection.query(
      `INSERT INTO registrations
         (user_id, game_id, status, fee_paid, utr, payment_method, approved_by, approved_at)
       VALUES (?, ?, 'approved', ?, ?, ?, 'admin', NOW())`,
      [userId, game_id, game.entry_fee, utr || null, payment_method]
    );
    const captainRegId = regResult.insertId;

    if (game.category === 'duo') {
      if (!partner_roll) {
        await connection.rollback();
        return res.status(400).json({ error: 'Partner roll number is required' });
      }
      const [[partner]] = await connection.query(
        'SELECT id FROM users WHERE roll_number = ? AND is_active = TRUE LIMIT 1',
        [partner_roll.toUpperCase()]
      );
      if (!partner) {
        await connection.rollback();
        return res.status(404).json({ error: `Partner ${partner_roll} not found` });
      }

      const [partnerRegResult] = await connection.query(
        `INSERT INTO registrations
           (user_id, game_id, status, fee_paid, payment_method, partner_reg_id, approved_by, approved_at)
         VALUES (?, ?, 'approved', ?, ?, ?, 'admin', NOW())`,
        [partner.id, game_id, game.entry_fee, payment_method, captainRegId]
      );
      await connection.query(
        'UPDATE registrations SET partner_reg_id = ? WHERE id = ?',
        [partnerRegResult.insertId, captainRegId]
      );

      const [teamRes] = await connection.query('INSERT INTO teams (game_id, team_name) VALUES (?, ?)', [game_id, team_name]);
      await connection.query(
        'INSERT INTO team_members (team_id, user_id) VALUES (?, ?), (?, ?)',
        [teamRes.insertId, userId, teamRes.insertId, partner.id]
      );
    }

    if (game.category === 'team') {
      const rolls = member_rolls
        ? member_rolls.split(/[\n,]+/).map(r => r.trim().toUpperCase()).filter(Boolean)
        : [];
      const totalPlayers = 1 + rolls.length;

      const memberIds = [];
      for (const roll of rolls) {
        const [[member]] = await connection.query(
          'SELECT id FROM users WHERE roll_number = ? AND is_active = TRUE LIMIT 1', [roll]
        );
        if (!member) {
          await connection.rollback();
          return res.status(404).json({ error: `Member ${roll} not found` });
        }
        memberIds.push(member.id);
      }

      const totalFee = game.entry_fee * totalPlayers;
      await connection.query(
        `UPDATE registrations SET is_captain = TRUE, declared_player_count = ?, fee_paid = ? WHERE id = ?`,
        [totalPlayers, totalFee, captainRegId]
      );

      const [teamRes] = await connection.query('INSERT INTO teams (game_id, team_name) VALUES (?, ?)', [game_id, team_name]);
      const allMembers = [userId, ...memberIds];
      await connection.query(
        'INSERT INTO team_members (team_id, user_id) VALUES ?',
        [allMembers.map(uid => [teamRes.insertId, uid])]
      );
    }

    await connection.query(
      "INSERT INTO audit_log (action, actor, target_type, target_id, detail) VALUES ('manual_registration','admin','registration',?,?)",
      [captainRegId, JSON.stringify({ user_id: userId, game_id, payment_method, category: game.category })]
    );

    await connection.commit();
    res.status(201).json({ success: true, registration_id: captainRegId });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'User is already registered for this game, or team name is taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create registration' });
  } finally {
    connection.release();
  }
});

// Per-game registrant list
router.get('/games/:gameId/registrants', [param('gameId').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name, u.roll_number, u.email, u.phone, u.department, u.year
       FROM registrations r JOIN users u ON u.id = r.user_id
       WHERE r.game_id = ? ORDER BY r.status, u.name`,
      [req.params.gameId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch registrants' });
  }
});

// CSV export — streams the filtered user list
router.get('/users/export', async (req, res) => {
  try {
    const { q, department, year, game_id, status } = req.query;
    const params = [];
    const conditions = [];

    if (q) {
      const like = `%${q}%`;
      conditions.push(`(u.name LIKE ? OR u.roll_number LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`);
      params.push(like, like, like, like);
    }
    if (department) { conditions.push('u.department = ?'); params.push(department); }
    if (year)       { conditions.push('u.year = ?');       params.push(year); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [users] = await db.query(
      `SELECT u.name, u.roll_number, u.department, u.year, u.email, u.phone, u.created_at
       FROM users u ${where} ORDER BY u.name`,
      params
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');

    const header = 'Name,Roll Number,Department,Year,Email,Phone,Joined\n';
    res.write(header);
    users.forEach(u => {
      const row = [u.name, u.roll_number, u.department, u.year, u.email, u.phone, u.created_at]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
      res.write(row + '\n');
    });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
