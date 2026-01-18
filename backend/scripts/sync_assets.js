/**
 * Assets Sync Script
 * Scans ASSETS_ROOT and inserts missing records into the database.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../database/connection');

const ASSETS_ROOT = process.env.ASSETS_ROOT || path.join(__dirname, '..', 'assets');

const checksumFile = (filePath) => {
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
};

const getMimeType = (ext) => {
    const mimes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
    };
    return mimes[ext.toLowerCase()] || 'application/octet-stream';
};

async function sync() {
    console.log(`Scanning assets in: ${ASSETS_ROOT}`);

    const categories = ['images', 'videos', 'general'];

    for (const cat of categories) {
        const dir = path.join(ASSETS_ROOT, cat);
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir);
        console.log(`Checking category [${cat}]: ${files.length} files found.`);

        for (const file of files) {
            if (file.startsWith('.') || fs.statSync(path.join(dir, file)).isDirectory()) continue;

            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            const checksum = checksumFile(filePath);
            const ext = path.extname(file);
            const mime = getMimeType(ext);
            const relativePath = path.join(cat, file).replace(/\\/g, '/');
            const url = `/assets/${relativePath}`;

            try {
                // Check if already exists
                const existing = await query('SELECT id FROM assets WHERE filename = ? OR checksum_sha256 = ?', [file, checksum]);

                if (existing.length === 0) {
                    console.log(`+ Adding ${file} to database...`);
                    await query(
                        `INSERT INTO assets (filename, original_name, path, url, type, size, category, checksum_sha256)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [file, file, relativePath, url, mime, stats.size, cat, checksum]
                    );
                } else {
                    // console.log(`~ ${file} already tracked.`);
                }
            } catch (err) {
                console.error(`! Failed to sync ${file}:`, err.message);
            }
        }
    }

    console.log('Sync complete.');
    process.exit(0);
}

sync().catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
});
