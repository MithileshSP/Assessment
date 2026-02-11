require('dotenv').config({ path: '../../.env' });
const { query, pool } = require('../connection');

async function runhelper() {
    try {
        console.log("Running migration: Drop unique_active_assignment index...");

        // Check if index exists usually requires querying information_schema, but we can just try DROP and catch error if not exists
        // Or specific MySQL syntax: DROP INDEX IF EXISTS (MySQL 8.0+)
        // Since we don't know exact version, let's use try-catch block with standard DROP.

        try {
            await query("ALTER TABLE challenge_assignments DROP INDEX unique_active_assignment");
            console.log("✅ Index dropped successfully.");
        } catch (e) {
            if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log("ℹ️ Index does not exist, skipping.");
            } else {
                throw e;
            }
        }

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

runhelper();
