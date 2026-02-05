const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

async function repair() {
    const jsonPath = path.join(__dirname, 'backend/data/challenges-new.json');
    console.log('Reading JSON from:', jsonPath);

    let data;
    try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        console.error('Failed to read JSON:', e.message);
        return;
    }

    console.log(`Processing ${data.length} challenges...`);

    // Mapping based on timestamp batches found in analysis
    const batchMapping = {
        "1769078356757": 1,
        "1769245429678": 2,
        "1770006506949": 3,
        "1770029161513": 4
    };

    let updatedCount = 0;
    data.forEach(q => {
        // Only re-map if it's currently level 1 (avoid double-mapping or hitting the already-level-4 ones)
        if (String(q.level) === '1') {
            const match = q.id.match(/\d{13}/);
            if (match) {
                const ts = match[0];
                if (batchMapping[ts] && batchMapping[ts] !== 1) {
                    q.level = batchMapping[ts];
                    updatedCount++;
                }
            }
        }

        // Also ensure courseId is consistent
        if (q.id.includes('course-fullstack') && q.courseId !== 'course-fullstack') {
            q.courseId = 'course-fullstack';
        }
    });

    console.log(`Updated ${updatedCount} levels in JSON.`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    console.log('Saved updated JSON.');

    // Now Sync with Database
    console.log('Syncing with database...');
    const connection = await mysql.createConnection({
        host: 'localhost', // Force localhost for host-side execution
        port: 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'gokul',
        database: process.env.DB_NAME || 'fullstack_test_portal'
    });

    try {
        for (const q of data) {
            // Update both level and course_id
            await connection.execute(
                'UPDATE challenges SET level = ?, course_id = ? WHERE id = ?',
                [q.level, q.courseId || q.course_id || null, q.id]
            );
        }
        console.log('Database synchronization complete.');
    } catch (err) {
        console.error('Database sync error:', err.message);
    } finally {
        await connection.end();
    }
}

repair();
