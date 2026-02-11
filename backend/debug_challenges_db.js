require('dotenv').config({ path: '../.env' });

process.env.DB_HOST = '127.0.0.1';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'gokul';
process.env.DB_NAME = 'fullstack_test_portal';
process.env.DB_PORT = 3307;

const { query } = require('./database/connection');

async function checkDBChallenges() {
    try {
        const sql = `SELECT id, course_id FROM challenges WHERE course_id = 'course-fullstack'`;
        const results = await query(sql);

        console.log(`COUNT: ${results.length}`);
        console.log(JSON.stringify(results));

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkDBChallenges();
