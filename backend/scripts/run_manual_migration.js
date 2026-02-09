const { applyMigrations } = require('../services/dbMigration');
require('dotenv').config();

async function run() {
    try {
        console.log('🚀 Manually triggering migrations...');
        await applyMigrations();
        console.log('✅ Migrations complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

run();
