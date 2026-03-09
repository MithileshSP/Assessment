require('dotenv').config();
const db = require('./database/connection');

async function check() {
    try {
        const query = `SELECT id, full_name, email, role FROM users WHERE id='user-ai-evaluator'`;
        const results = await db.query(query);
        console.log("Result for 'user-ai-evaluator':", results);
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        process.exit(0);
    }
}
check();
