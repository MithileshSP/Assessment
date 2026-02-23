const db = require('./database/connection');

async function applyFix() {
    try {
        console.log('Applying migration 008...');
        await db.query(`ALTER TABLE assignment_logs MODIFY COLUMN action_type VARCHAR(50) NOT NULL`);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

applyFix();
