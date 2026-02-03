const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSchema() {
    console.log('Connecting to DB...');
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: 'gokul',
            database: 'fullstack_test_portal',
            port: 3307
        });

        console.log('Connected to database.');

        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'fullstack_test_portal' AND TABLE_NAME = 'test_attendance';
        `);

        console.log('Schema for test_attendance:');
        columns.forEach(col => {
            console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.COLUMN_TYPE})`);
        });

        await connection.end();
    } catch (error) {
        console.error('Database check failed:', error.message);
    }
}

checkSchema();
