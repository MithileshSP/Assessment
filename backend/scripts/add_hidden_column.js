
const { query, pool } = require('./database/connection');

async function migrate() {
    console.log('Starting migration...');
    try {
        // Check if column exists
        const columns = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'is_hidden'
    `);

        if (columns.length > 0) {
            console.log('Column is_hidden already exists.');
        } else {
            console.log('Adding is_hidden column...');
            await query(`
        ALTER TABLE courses 
        ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
      `);
            await query(`
        CREATE INDEX idx_is_hidden ON courses(is_hidden);
      `);
            console.log('Column added successfully.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (pool) await pool.end();
        process.exit(0);
    }
}

// Wait for connection
setTimeout(migrate, 1000);
