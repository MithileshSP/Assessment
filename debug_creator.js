require('dotenv').config({ path: './backend/.env' });
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
const { query } = require('./backend/database/connection');

async function debugCreator() {
    try {
        const users = await query("SELECT id, full_name, role FROM users WHERE role IN ('admin', 'faculty')");
        console.log('--- Faculty/Admin Users ---');
        users.forEach(u => console.log(`${u.id} | ${u.full_name} | ${u.role}`));

        const challenges = await query("SELECT id, title, created_by FROM challenges WHERE created_by IS NOT NULL");
        console.log('\n--- Challenges with Creators ---');
        challenges.forEach(c => console.log(`${c.id} | ${c.title} | ${c.created_by}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugCreator();
