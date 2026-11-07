const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// QR stored as base64 data URL in DB (no external service required)
const qrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
});

function validateMagicBytes(req, res, next) {
  if (!req.file) return next();
  const buf = req.file.buffer;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf.toString('ascii', 0, 4) === 'RIFF';
  if (!isJpeg && !isPng && !isWebp) {
    return res.status(400).json({ error: 'File content does not match an allowed image type' });
  }
  next();
}

// Get payment info (public — no auth)
router.get('/payment-info', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT `key`, value FROM settings WHERE `key` IN ('qr_url','upi_id','payee_name')"
    );
    const info = {};
    rows.forEach(r => { info[r.key] = r.value; });
    res.json(info);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment info' });
  }
});

// Upload new QR image — admin only
router.post('/qr', requireAdmin, qrUpload.single('qr'), validateMagicBytes, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const qr_url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await db.query(
      "INSERT INTO settings (`key`, value, updated_by) VALUES ('qr_url', ?, 'admin') ON DUPLICATE KEY UPDATE value = ?, updated_by = 'admin'",
      [qr_url, qr_url]
    );
    await db.query(
      "INSERT INTO audit_log (action, actor, target_type, detail) VALUES ('qr_updated', 'admin', 'settings', ?)",
      [JSON.stringify({ qr_url })]
    );
    res.json({ success: true, qr_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save QR' });
  }
});

// Update UPI ID and payee name — admin only
router.post('/upi', requireAdmin, [
  body('upi_id').trim().notEmpty().isLength({ max: 100 }),
  body('payee_name').trim().notEmpty().isLength({ max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

  try {
    const { upi_id, payee_name } = req.body;
    await db.query(
      "INSERT INTO settings (`key`, value, updated_by) VALUES ('upi_id', ?, 'admin') ON DUPLICATE KEY UPDATE value = ?, updated_by = 'admin'",
      [upi_id, upi_id]
    );
    await db.query(
      "INSERT INTO settings (`key`, value, updated_by) VALUES ('payee_name', ?, 'admin') ON DUPLICATE KEY UPDATE value = ?, updated_by = 'admin'",
      [payee_name, payee_name]
    );
    await db.query(
      "INSERT INTO audit_log (action, actor, target_type, detail) VALUES ('upi_updated', 'admin', 'settings', ?)",
      [JSON.stringify({ upi_id, payee_name })]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update UPI settings' });
  }
});

// QR change history — admin only
router.get('/qr-history', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT actor, detail, created_at FROM audit_log WHERE action IN ('qr_updated','upi_updated') ORDER BY created_at DESC LIMIT 50"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
