const { query } = require('../database/connection');

async function check() {
    try {
        const users = await query("SELECT id, username, role FROM users");
        console.log('👥 Users:', JSON.stringify(users, null, 2));
    } catch (err) {
        console.log('❌ Error:', err.message);
    }
    process.exit(0);
}

check();
