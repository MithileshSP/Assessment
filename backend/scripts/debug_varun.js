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

        const [columns] = await connection.execute(`
            SHOW COLUMNS FROM test_attendance LIKE 'session_id';
        `);
        console.log('Session ID Column:');
        console.log(JSON.stringify(columns, null, 2));

        const [tables] = await connection.execute('SHOW TABLES');
        console.log('Tables:');
        console.table(tables);

        const [users] = await connection.execute(`
            SELECT id, full_name, is_blocked, role, email FROM users
        `);
        console.log('All Users:');
        console.table(users);

        const [attendance] = await connection.execute(`
            SELECT id, user_id, test_identifier, session_id, is_used, status, requested_at 
            FROM test_attendance 
            WHERE is_used = 0
            ORDER BY requested_at DESC
        `);
        console.log('Active Attendance Records:');
        console.table(attendance);

        await connection.end();
    } catch (error) {
        console.error('Database check failed:', error.message);
    }
}

checkSchema();
