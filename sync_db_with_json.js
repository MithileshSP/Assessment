const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

async function sync() {
    const jsonPath = path.join(__dirname, 'backend/data/challenges-new.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log(`Connecting to database to sync ${data.length} challenges...`);
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'gokul',
        database: process.env.DB_NAME || 'fullstack_test_portal'
    });

    try {
        // Disable foreign key checks to allow truncation if needed (though submissions are 0)
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('TRUNCATE TABLE challenges');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Cleared challenges table.');

        for (const q of data) {
            const id = q.id;
            const title = q.title;
            const description = q.description;
            const instructions = q.instructions;
            const tags = JSON.stringify(q.tags || []);
            const passing_threshold = JSON.stringify(q.passingThreshold || { structure: 80, visual: 80, overall: 75 });
            const expected_html = q.expectedSolution?.html || '';
            const expected_css = q.expectedSolution?.css || '';
            const expected_js = q.expectedSolution?.js || '';
            const course_id = q.courseId || q.course_id || null;
            const level = q.level || 1;
            const points = q.points || 100;
            const assets = JSON.stringify(q.assets || { images: [], reference: '' });
            const challenge_type = q.challengeType || 'web';
            const expected_output = q.expectedOutput || '';

            await connection.execute(
                `INSERT INTO challenges 
                (id, title, description, instructions, tags, passing_threshold, expected_html, expected_css, expected_js, course_id, level, points, assets, challenge_type, expected_output, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [id, title, description, instructions, tags, passing_threshold, expected_html, expected_css, expected_js, course_id, level, points, assets, challenge_type, expected_output]
            );
        }
        console.log('Successfully imported all challenges to database.');
    } catch (err) {
        console.error('Error during sync:', err.message);
    } finally {
        await connection.end();
    }
}

sync();
