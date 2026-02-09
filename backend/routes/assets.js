/**
 * Assets Routes (filesystem storage, DB metadata)
 * Admin-only mutations; public read
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

const ASSETS_ROOT = process.env.ASSETS_ROOT || '/var/www/portal-assets';
const JWT_SECRET = process.env.JWT_SECRET;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const sanitizeCategory = (raw) => {
  const val = (raw || 'images').toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(val) ? val : 'images';
};

const requireAdmin = (req, res, next) => {
  try {
    // Check both 'authToken' (standard) and 'token' (legacy/dev)
    const token = req.cookies?.authToken || req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.warn('[Assets] Missing token in cookies/header');
      return res.status(401).json({ error: 'Missing token' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    const payload = jwt.verify(token, jwtSecret);

    if (payload.role !== 'admin') {
      console.warn(`[Assets] Unauthorized role: ${payload.role}`);
      return res.status(403).json({ error: 'Admin only' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    console.error('[Assets] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Multer storage targeting category folders under ASSETS_ROOT
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = sanitizeCategory(req.body.category);
    const uploadDir = path.join(ASSETS_ROOT, category);
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();
    cb(null, `${name}${ext}`);
  }
});

const allowedMimes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});

// Minimal magic-number validation; basic SVG hardening
const isMagicValid = (filePath, mime) => {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(256);
  fs.readSync(fd, buffer, 0, 256, 0);
  fs.closeSync(fd);

  const header = buffer.slice(0, 12);
  const str = buffer.toString('utf8').toLowerCase();

  if (mime === 'image/png') return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  if (mime === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8;
  if (mime === 'image/gif') return str.startsWith('gif8');
  if (mime === 'image/webp') return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  if (mime === 'image/svg+xml') {
    const fullStr = fs.readFileSync(filePath, 'utf8').toLowerCase(); // SVG needs full scan for security
    if (!fullStr.includes('<svg')) return false;
    if (fullStr.includes('<script') || fullStr.includes('onload=')) return false;
    return true;
  }
  return false;
};

// Helper to compute SHA-256 checksum
const checksumFile = (filePath) => {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
};

// Public: list assets (optional category filter)
router.get('/', async (req, res) => {
  try {
    const rawCat = req.query.category;
    const category = rawCat ? sanitizeCategory(rawCat) : null;
    const rows = await query(
      category
        ? 'SELECT filename, url, type, size, category, uploaded_at FROM assets WHERE category = ? ORDER BY uploaded_at DESC'
        : 'SELECT filename, url, type, size, category, uploaded_at FROM assets ORDER BY uploaded_at DESC',
      category ? [category] : []
    );
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch assets:', error.message);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Admin: upload asset
router.post('/upload', requireAdmin, upload.single('asset'), async (req, res) => {
  let filePath;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const category = sanitizeCategory(req.body.category);
    filePath = req.file.path;

    if (!isMagicValid(filePath, req.file.mimetype)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'File content does not match type' });
    }

    const checksum = checksumFile(filePath);

    // reject duplicates by checksum+category
    const existing = await query(
      'SELECT filename, url, category FROM assets WHERE checksum_sha256 = ? AND category = ? LIMIT 1',
      [checksum, category]
    );
    if (existing.length) {
      fs.unlinkSync(filePath);
      return res.status(200).json(existing[0]);
    }

    const relativePath = path.relative(ASSETS_ROOT, filePath).replace(/\\/g, '/');
    const url = `/assets/${relativePath}`;

    await query(
      `INSERT INTO assets (filename, original_name, path, url, type, size, category, checksum_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE path=VALUES(path), url=VALUES(url), type=VALUES(type), size=VALUES(size), category=VALUES(category), checksum_sha256=VALUES(checksum_sha256)`,
      [
        req.file.filename,
        req.file.originalname,
        relativePath,
        url,
        req.file.mimetype,
        req.file.size,
        category,
        checksum
      ]
    );

    res.status(201).json({
      filename: req.file.filename,
      url,
      category,
      type: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error.message);
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    }
    res.status(500).json({ error: 'Failed to upload asset' });
  }
});

// Admin: delete asset by filename
router.delete('/:filename', requireAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT path FROM assets WHERE filename = ? LIMIT 1', [req.params.filename]);
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });

    const filePath = path.join(ASSETS_ROOT, rows[0].path);
    let fileError = null;
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (err) { fileError = err; }
    }

    await query('DELETE FROM assets WHERE filename = ?', [req.params.filename]);
    if (fileError) {
      return res.status(200).json({ message: 'Asset deleted from DB; file removal failed', warning: fileError.message });
    }
    res.json({ message: 'Asset deleted' });
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// Public: categories
router.get('/categories', async (req, res) => {
  try {
    const rows = await query('SELECT DISTINCT category FROM assets ORDER BY category');
    res.json(rows.map(r => r.category));
  } catch (error) {
    console.error('Failed to fetch categories:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
