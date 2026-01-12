const { query } = require('./backend/database/connection');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
    console.log('🚀 Starting migration...');
    try {
        // Add diff_screenshot
        console.log('Adding diff_screenshot column...');
        await query('ALTER TABLE submissions ADD COLUMN diff_screenshot VARCHAR(500) AFTER expected_screenshot');

        // Add admin_override_status
        console.log('Adding admin_override_status column...');
        await query("ALTER TABLE submissions ADD COLUMN admin_override_status ENUM('passed', 'failed', 'none') DEFAULT 'none'");

        // Add admin_override_reason
        console.log('Adding admin_override_reason column...');
        await query('ALTER TABLE submissions ADD COLUMN admin_override_reason TEXT');

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('ℹ️ Columns already exist, skipping migration.');
            process.exit(0);
        }
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
