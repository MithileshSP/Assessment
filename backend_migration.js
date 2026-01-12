const { query } = require('./database/connection');

async function migrate() {
    console.log('🚀 Starting migration...');
    try {
        // Add diff_screenshot
        console.log('Adding diff_screenshot column...');
        try {
            await query('ALTER TABLE submissions ADD COLUMN diff_screenshot VARCHAR(500) AFTER expected_screenshot');
            console.log('✅ diff_screenshot added');
        } catch (e) {
            if (e.message.includes('Duplicate column name')) {
                console.log('ℹ️ diff_screenshot already exists');
            } else {
                throw e;
            }
        }

        // Add admin_override_status
        console.log('Adding admin_override_status column...');
        try {
            await query("ALTER TABLE submissions ADD COLUMN admin_override_status ENUM('passed', 'failed', 'none') DEFAULT 'none'");
            console.log('✅ admin_override_status added');
        } catch (e) {
            if (e.message.includes('Duplicate column name')) {
                console.log('ℹ️ admin_override_status already exists');
            } else {
                throw e;
            }
        }

        // Add admin_override_reason
        console.log('Adding admin_override_reason column...');
        try {
            await query('ALTER TABLE submissions ADD COLUMN admin_override_reason TEXT');
            console.log('✅ admin_override_reason added');
        } catch (e) {
            if (e.message.includes('Duplicate column name')) {
                console.log('ℹ️ admin_override_reason already exists');
            } else {
                throw e;
            }
        }

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
