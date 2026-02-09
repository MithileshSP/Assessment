process.env.USE_JSON = 'false';
require('dotenv').config({ path: './backend/.env' });
const { query } = require('./backend/database/connection');

async function checkSchema() {
    try {
        const columns = await query("SHOW COLUMNS FROM submissions");
        console.log("Submissions columns:", columns.map(c => c.Field));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
