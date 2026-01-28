
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixSchema() {
    console.log('Connecting to DB at port 3307...');
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'rootpassword',
            database: process.env.DB_NAME || 'fullstack_test_portal',
            port: 3307
        });

        console.log('Connected to database.');

        // Check if column exists
        const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'passing_threshold';
    `, [process.env.DB_NAME || 'fullstack_test_portal']);

        if (columns.length === 0) {
            console.log('Column passing_threshold is MISSING. Adding it now...');

            // Add the column
            await connection.execute(`
        ALTER TABLE courses
        ADD COLUMN passing_threshold JSON AFTER tags;
      `);

            console.log('SUCCESS: Added passing_threshold column.');
        } else {
            console.log('Column passing_threshold already exists.');
        }

        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
}

fixSchema();
