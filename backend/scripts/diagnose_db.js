const { query, queryOne, isConnected } = require('../database/connection');
const dotenv = require('dotenv');
const path = require('path');

async function diagnose() {
    console.log('--- Database Table Check ---');
    const tables = [
        'users', 'courses', 'challenges', 'submissions',
        'user_progress', 'test_sessions', 'student_feedback',
        'global_test_sessions', 'test_attendance'
    ];

    for (const table of tables) {
        try {
            const result = await query(`SHOW TABLES LIKE '${table}'`);
            if (result.length > 0) {
                const count = await query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`✅ Table '${table}' exists. Count: ${count[0].count}`);

                if (table === 'submissions') {
                    const cols = await query(`SHOW COLUMNS FROM ${table}`);
                    console.log(`📋 Columns for ${table}:`, cols.map(c => c.Field).join(', '));
                }
            } else {
                console.log(`❌ Table '${table}' MISSING!`);
            }
        } catch (err) {
            console.log(`❌ Error checking '${table}':`, err.message);
        }
    }
    process.exit(0);
}

diagnose();
