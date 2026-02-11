require('dotenv').config({ path: '../.env' });

process.env.DB_HOST = '127.0.0.1';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'gokul';
process.env.DB_NAME = 'fullstack_test_portal';
process.env.DB_PORT = 3307;

const { query } = require('./database/connection');

async function checkSubmissions() {
    try {
        console.log("Querying one submission to check columns...");
        const sql = `SELECT * FROM submissions LIMIT 1`;

        const results = await query(sql);
        if (results.length > 0) {
            console.log("Columns:", Object.keys(results[0]));
        } else {
            console.log("No submissions found.");
        }

        console.log("Querying recent submissions (without 'result' if not present)...");
        const safeSql = `SELECT id, user_id, challenge_id, status, passed, submitted_at 
                   FROM submissions 
                   ORDER BY submitted_at DESC LIMIT 5`;
        const recent = await query(safeSql);
        console.log(JSON.stringify(recent, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkSubmissions();
