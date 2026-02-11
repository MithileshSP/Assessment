require('dotenv').config({ path: '../.env' });
const { query, pool } = require('../database/connection');

async function checkQuestions() {
    try {
        console.log("Checking questions...");
        const qs = await query('SELECT id, title, course_id FROM challenges WHERE course_id = ?', ['course-fullstack']);
        console.log('Count:', qs.length);
        console.log('IDs:', qs.map(q => q.id));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkQuestions();
