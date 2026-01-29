/**
 * Fix Stuck Submissions Migration
 * This script updates any submissions with status 'pending' to 'queued'
 * so they can be picked up by the background evaluation worker.
 */
const { query } = require('./database/connection');

async function fixStuckSubmissions() {
    console.log('🔄 Starting migration: Fix Stuck Submissions');
    try {
        const result = await query(
            "UPDATE submissions SET status = 'queued' WHERE status = 'pending'"
        );
        console.log(`✅ Migration complete. ${result.affectedRows || 0} submissions moved to queue.`);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

// Export for use in applyMigrations
module.exports = fixStuckSubmissions;
