const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSubmissions() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'portal_user',
        password: process.env.DB_PASSWORD || 'portal_password',
        database: process.env.DB_NAME || 'portal_db',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log("Checking courses and challenges...");
        const [rows] = await db.query(`
            SELECT s.id, c.title as course_title, ch.title as challenge_title 
            FROM submissions s 
            LEFT JOIN courses c ON s.course_id = c.id 
            LEFT JOIN challenges ch ON s.challenge_id = ch.id
        `);
        console.log("All submissions data:", rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await db.end();
    }
}

checkSubmissions();
