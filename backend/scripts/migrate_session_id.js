const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force local connection parameters for host-side script
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
process.env.DB_PASSWORD = 'gokul';

const { query } = require('../database/connection');

async function fixSessionIdType() {
    console.log('🔄 Migrating session_id column to VARCHAR(255)...');
    try {
        await query("ALTER TABLE test_attendance MODIFY COLUMN session_id VARCHAR(255) NULL");
        console.log('✅ session_id column successfully migrated to VARCHAR(255).');
    } catch (e) {
        console.error('❌ Migration failed:', e.message);
    } finally {
        process.exit(0);
    }
}

fixSessionIdType();
