const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSchema() {
    console.log('Connecting to DB at port 3307...');
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1', // Use IP to avoid socket confusion
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'rootpassword',
            database: process.env.DB_NAME || 'fullstack_test_portal',
            port: 3307 // Port mapped in docker-compose
        });

        console.log('Connected to database.');

        const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'courses';
    `, [process.env.DB_NAME || 'fullstack_test_portal']);

        const columnNames = columns.map(c => c.COLUMN_NAME);
        console.log('Columns in courses table:', columnNames.join(', '));

        if (columnNames.includes('passing_threshold')) {
            console.log('SUCCESS: passing_threshold column exists.');
        } else {
            console.log('FAILURE: passing_threshold column is MISSING.');
        }

        await connection.end();
    } catch (error) {
        console.error('Database connection failed:', error.message);
        console.log('Ensure the docker container is running and port 3307 is accessible.');
    }
}

checkSchema();
