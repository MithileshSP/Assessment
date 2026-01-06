const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'portal_mysql',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gokul',
    database: process.env.DB_NAME || 'fullstack_test_portal',
};

async function fixDatabase() {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Check current schema
        console.log('\n--- Current Schema ---');
        const [rows] = await connection.query('DESCRIBE users');
        const emailCol = rows.find(r => r.Field === 'email');
        console.log('Email Column:', emailCol);

        // 2. Fix bad data (empty strings -> NULL)
        console.log('\n--- Fixing Bad Data ---');
        const [updateResult] = await connection.query("UPDATE users SET email = NULL WHERE email = ''");
        console.log('Converted empty string emails to NULL:', updateResult.info);

        // 3. Update Table Schema (Force Nullable)
        console.log('\n--- Updating Schema ---');
        await connection.query("ALTER TABLE users MODIFY email VARCHAR(100) NULL DEFAULT NULL");
        console.log('Schema updated successfully.');

        // 4. Verify Schema
        console.log('\n--- New Schema ---');
        const [newRows] = await connection.query('DESCRIBE users');
        const newEmailCol = newRows.find(r => r.Field === 'email');
        console.log('Email Column:', newEmailCol);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await connection.end();
    }
}

fixDatabase();
