const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../database');
const { requireStudent, requireAdmin, requireAuth } = require('../middleware/auth');

// Cloudinary multer storage for screenshots
const screenshotStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sports-day/screenshots',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ quality: 'auto' }],
  },
});

function validateMagicBytes(req, res, next) {
  if (!req.file) return next();
  const buf = req.file.buffer || Buffer.alloc(0);
  // Magic bytes: JPEG FF D8, PNG 89 50 4E 47, WebP 52 49 46 46
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) {
    return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
  }
  next();
}

const screenshotUpload = multer({
  storage: screenshotStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

// Student submits a registration
router.post('/', requireStudent, screenshotUpload.single('screenshot'),
  [
    body('game_id').isInt(),
    body('utr').optional().trim().isLength({ max: 100 }),
    body('team_name').optional().trim().isLength({ max: 100 }),
    body('partner_roll').optional().trim(),
    body('member_rolls').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const userId = req.user.id;
      const { game_id, utr, partner_roll, team_name, member_rolls } = req.body;
      const screenshot_url = req.file?.path ?? null;

      // Load game
      const [[game]] = await connection.query('SELECT * FROM games WHERE id = ? AND is_active = TRUE', [game_id]);
      if (!game) {
        await connection.rollback();
        return res.status(404).json({ error: 'Game not found or registration is closed' });
      }

      // Check registration window
      const now = new Date();
      if (game.reg_open_at && now < new Date(game.reg_open_at)) {
        await connection.rollback();
        return res.status(400).json({ error: 'Registration has not opened yet' });
      }
      if (game.reg_close_at && now > new Date(game.reg_close_at)) {
        await connection.rollback();
        return res.status(400).json({ error: 'Registration is closed' });
      }

      // Duplicate check
      const [existing] = await connection.query(
        'SELECT id, status FROM registrations WHERE user_id = ? AND game_id = ? LIMIT 1',
        [userId, game_id]
      );
      if (existing.length > 0) {
        await connection.rollback();
        const r = existing[0];
        const statusMsg = r.status === 'rejected' ? 'rejected — please resubmit' : r.status;
        return res.status(409).json({ error: `You already have a ${statusMsg} registration for this game` });
      }

      // Require team_name for duo/team
      if ((game.category === 'duo' || game.category === 'team') && !team_name) {
        await connection.rollback();
        return res.status(400).json({ error: 'Team name is required' });
      }

      const feePaid = game.entry_fee;

      // Create student's registration
      const [result] = await connection.query(
        `INSERT INTO registrations (user_id, game_id, status, fee_paid, utr, screenshot_url, payment_method)
         VALUES (?, ?, 'pending', ?, ?, ?, 'upi')`,
        [userId, game_id, feePaid, utr || null, screenshot_url]
      );
      const regId = result.insertId;

      // Duo: create partner registration + team
      if (game.category === 'duo') {
        if (!partner_roll) {
          await connection.rollback();
          return res.status(400).json({ error: 'Partner roll number is required for duo events' });
        }
        const [[partner]] = await connection.query(
          'SELECT id FROM users WHERE roll_number = ? AND is_active = TRUE LIMIT 1',
          [partner_roll.toUpperCase()]
        );
        if (!partner) {
          await connection.rollback();
          return res.status(404).json({ error: 'Partner roll number not found. Partner must have an account.' });
        }
        if (partner.id === userId) {
          await connection.rollback();
          return res.status(400).json({ error: 'You cannot partner with yourself' });
        }

        const [partnerExisting] = await connection.query(
          'SELECT id FROM registrations WHERE user_id = ? AND game_id = ? LIMIT 1',
          [partner.id, game_id]
        );
        if (partnerExisting.length > 0) {
          await connection.rollback();
          return res.status(409).json({ error: 'Your partner already has a registration for this game' });
        }

        const [partnerResult] = await connection.query(
          `INSERT INTO registrations (user_id, game_id, status, fee_paid, payment_method, partner_reg_id)
           VALUES (?, ?, 'pending', ?, 'upi', ?)`,
          [partner.id, game_id, feePaid, regId]
        );
        await connection.query(
          'UPDATE registrations SET partner_reg_id = ? WHERE id = ?',
          [partnerResult.insertId, regId]
        );

        // Create team for the duo pair
        const [teamRes] = await connection.query(
          'INSERT INTO teams (game_id, team_name) VALUES (?, ?)',
          [game_id, team_name]
        );
        const teamId = teamRes.insertId;
        await connection.query(
          'INSERT INTO team_members (team_id, user_id) VALUES (?, ?), (?, ?)',
          [teamId, userId, teamId, partner.id]
        );
      }

      // Team captain: validate member rolls, create team
      if (game.category === 'team') {
        const memberRolls = member_rolls
          ? member_rolls.split(/[\n,]+/).map(r => r.trim().toUpperCase()).filter(Boolean)
          : [];
        const totalPlayers = 1 + memberRolls.length;
        if (totalPlayers < game.min_team_size || totalPlayers > game.max_team_size) {
          await connection.rollback();
          return res.status(400).json({
            error: `Team must have ${game.min_team_size}–${game.max_team_size} players total (including yourself). You provided ${memberRolls.length} others.`
          });
        }

        // Look up all members
        const memberIds = [];
        for (const roll of memberRolls) {
          const [[member]] = await connection.query(
            'SELECT id FROM users WHERE roll_number = ? AND is_active = TRUE LIMIT 1',
            [roll]
          );
          if (!member) {
            await connection.rollback();
            return res.status(404).json({ error: `Member with roll number ${roll} not found. All members must have accounts.` });
          }
          if (member.id === userId) {
            await connection.rollback();
            return res.status(400).json({ error: 'Do not include your own roll number in the members list' });
          }
          if (memberIds.includes(member.id)) {
            await connection.rollback();
            return res.status(400).json({ error: `Duplicate member: ${roll}` });
          }
          memberIds.push(member.id);
        }

        const totalFee = game.entry_fee * totalPlayers;
        await connection.query(
          `UPDATE registrations SET is_captain = TRUE, declared_player_count = ?, fee_paid = ? WHERE id = ?`,
          [totalPlayers, totalFee, regId]
        );

        // Create team with all members
        const [teamRes] = await connection.query(
          'INSERT INTO teams (game_id, team_name) VALUES (?, ?)',
          [game_id, team_name]
        );
        const teamId = teamRes.insertId;
        const allMembers = [userId, ...memberIds];
        await connection.query(
          'INSERT INTO team_members (team_id, user_id) VALUES ?',
          [allMembers.map(uid => [teamId, uid])]
        );
      }

      await connection.commit();
      res.status(201).json({ success: true, id: regId });
    } catch (err) {
      await connection.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Team name already taken for this game, or a member is already on a team' });
      }
      console.error(err);
      res.status(500).json({ error: 'Failed to submit registration' });
    } finally {
      connection.release();
    }
  }
);

// Student's own registrations
router.get('/mine', requireStudent, async (req, res) => {
  try {
    const [regs] = await db.query(
      `SELECT r.*, g.name AS game_name, g.category, g.entry_fee AS current_fee
       FROM registrations r
       JOIN games g ON g.id = r.game_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(regs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Admin: pending registrations queue
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const [regs] = await db.query(
      `SELECT r.*, u.name AS user_name, u.roll_number, u.email,
              g.name AS game_name, g.category
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       JOIN games g ON g.id = r.game_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at`
    );
    res.json(regs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
});

// Admin: approve/reject — with row locking to prevent double-approval
router.patch('/:id/status', [
  param('id').isInt(),
  body('status').isIn(['approved', 'rejected']),
  body('reason').optional().trim().isLength({ max: 500 }),
], requireAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { status, reason } = req.body;

    const [[reg]] = await connection.query(
      'SELECT * FROM registrations WHERE id = ? FOR UPDATE', [id]
    );
    if (!reg) { await connection.rollback(); return res.status(404).json({ error: 'Not found' }); }
    if (reg.status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ error: `Registration is already ${reg.status}` });
    }

    await connection.query(
      `UPDATE registrations SET status = ?, rejected_reason = ?, approved_by = 'admin', approved_at = NOW()
       WHERE id = ?`,
      [status, status === 'rejected' ? (reason || null) : null, id]
    );

    // Duo: update partner in the same transaction
    if (reg.partner_reg_id) {
      await connection.query(
        `UPDATE registrations SET status = ?, rejected_reason = ?, approved_by = 'admin', approved_at = NOW()
         WHERE id = ?`,
        [status, status === 'rejected' ? (reason || null) : null, reg.partner_reg_id]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    connection.release();
  }
});

module.exports = router;
