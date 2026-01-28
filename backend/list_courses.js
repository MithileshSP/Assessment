const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function listCourses() {
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

        const [courses] = await connection.execute(`SELECT id, title, is_hidden FROM courses`);

        console.log('Courses in database:');
        courses.forEach(c => {
            console.log(`  - ${c.id}: "${c.title}" (is_hidden: ${c.is_hidden})`);
        });

        await connection.end();
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
}

listCourses();
