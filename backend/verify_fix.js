require('dotenv').config({ path: __dirname + '/.env' }); // Load env vars
// Override for local execution against Docker
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';

const db = require('./database/connection');


async function checkSchema() {
    try {
        const [rows] = await db.query(`DESCRIBE assignment_logs`);
        const actionTypeCol = rows.find(r => r.Field === 'action_type');
        console.log('Column definition:', actionTypeCol);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
