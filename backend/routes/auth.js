const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database');

// Pre-hash admin password once at startup for constant-time compare
const adminPassHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

const signupValidation = [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('roll_number').trim().notEmpty().isLength({ max: 50 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail(),
  body('phone').trim().matches(/^\d{10}$/),
  body('department').trim().notEmpty().isLength({ max: 100 }),
  body('year').isInt({ min: 1, max: 4 }),
  body('password').isLength({ min: 8 }),
];

// Student signup
router.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { name, roll_number, email, phone, department, year, password } = req.body;
  // Store empty email as NULL
  const emailVal = (email && email.trim()) ? email.trim() : null;

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users (name, roll_number, email, phone, department, year, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, roll_number.toUpperCase(), emailVal, phone, department, year, password_hash]
    );

    const token = jwt.sign(
      { id: result.insertId, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ success: true, token });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const field = err.message.includes('roll_number') ? 'roll number' : 'email';
      return res.status(409).json({ error: `An account with this ${field} already exists` });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unified login — tries admin username first, then student identifier
router.post('/login', [
  body('identifier').trim().notEmpty(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Those details don\'t match. Try again.' });
  }

  const { identifier, password } = req.body;
  const FAIL = { error: 'Those details don\'t match. Try again.' };

  // Admin path: constant-time compare so timing doesn't reveal username existence
  const a = Buffer.from(identifier.toLowerCase().padEnd(50));
  const b = Buffer.from(process.env.ADMIN_USERNAME.toLowerCase().padEnd(50));
  const usernameMatch = crypto.timingSafeEqual(a.slice(0, 50), b.slice(0, 50))
    && identifier.toLowerCase() === process.env.ADMIN_USERNAME.toLowerCase();
  if (usernameMatch) {
    const passOk = await bcrypt.compare(password, adminPassHash);
    if (!passOk) return res.status(401).json(FAIL);
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, role: 'admin' });
  }

  // Student path
  try {
    const [rows] = await db.query(
      `SELECT * FROM users
       WHERE (email = ? OR roll_number = ?) AND is_active = TRUE LIMIT 1`,
      [identifier.toLowerCase(), identifier.toUpperCase()]
    );

    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json(FAIL);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json(FAIL);

    const token = jwt.sign(
      { id: user.id, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      role: 'student',
      user: { id: user.id, name: user.name, roll_number: user.roll_number, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Keep old admin-login route returning 410 so cached links break loudly
router.post('/admin-login', (req, res) => {
  res.status(410).json({ error: 'This endpoint is gone. Use /auth/login.' });
});

module.exports = router;
