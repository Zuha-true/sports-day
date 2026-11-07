const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// GET /api/departments — public, used by signup and admin filters
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, active FROM departments ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/departments — admin
router.post('/', requireAdmin, [
  body('name').trim().notEmpty().isLength({ max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await db.query(
      'INSERT INTO departments (name) VALUES (?)',
      [req.body.name.trim()]
    );
    res.status(201).json({ id: result.insertId, name: req.body.name.trim(), active: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Department already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/departments/:id — admin, rename or toggle active
router.patch('/:id', requireAdmin, [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('active').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid fields' });
  const { name, active } = req.body;
  if (name === undefined && active === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  const fields = [];
  const vals = [];
  if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()); }
  if (active !== undefined) { fields.push('active = ?'); vals.push(active ? 1 : 0); }
  vals.push(req.params.id);
  try {
    const [result] = await db.query(
      `UPDATE departments SET ${fields.join(', ')} WHERE id = ?`,
      vals
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Department not found' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Name already taken' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
