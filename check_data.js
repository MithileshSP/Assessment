require('dotenv').config({ path: './backend/.env' });
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
const { query } = require('./backend/database/connection');

async function checkUsers() {
    try {
        const users = await query("SELECT id, full_name, role FROM users WHERE full_name LIKE '%Varun%'");
        console.log('Users matching Varun:');
        users.forEach(u => console.log(`${u.id} | ${u.full_name} | ${u.role}`));

        const challenges = await query("SELECT id, title, created_by FROM challenges WHERE title IN ('6h', 'varun') OR title LIKE '1.Write a program%'");
        console.log('\nChallenges checking:');
        challenges.forEach(c => console.log(`${c.id} | ${c.title} | ${c.created_by}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
