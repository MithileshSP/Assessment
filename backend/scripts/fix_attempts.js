require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixAttemptNumbers() {
    console.log('--- Industry-Grade Attempt Number Reconciliation ---');
    
    // Manual connection to ensure we can handle 'localhost' vs 'portal_mysql'
    const dbConfig = {
        host: process.env.DB_HOST === 'portal_mysql' ? '127.0.0.1' : (process.env.DB_HOST || '127.0.0.1'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'fullstack_test_portal',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL for reconciliation.');

        // Check if is_deleted column exists to avoid query failure
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'submissions' AND COLUMN_NAME = 'is_deleted'
        `);
        const hasDeletedCol = columns.length > 0;
        const deletedFilter = hasDeletedCol ? 'AND is_deleted = 0' : '';

        // Get all unique user/challenge pairs that have multiple submissions
        const [pairs] = await connection.execute(`
            SELECT user_id, challenge_id, COUNT(*) as count 
            FROM submissions 
            WHERE status != 'saved' ${deletedFilter}
            GROUP BY user_id, challenge_id 
            HAVING count > 0
        `);

        console.log(`Found ${pairs.length} user/challenge sets to audit.`);

        let fixCount = 0;
        for (const pair of pairs) {
            // Get all submissions for this pair ordered by time
            const [subs] = await connection.execute(`
                SELECT id, submitted_at, attempt_number 
                FROM submissions 
                WHERE user_id = ? AND challenge_id = ? AND status != 'saved' ${deletedFilter}
                ORDER BY submitted_at ASC
            `, [pair.user_id, pair.challenge_id]);

            for (let i = 0; i < subs.length; i++) {
                const correctAttempt = i + 1;
                if (subs[i].attempt_number !== correctAttempt) {
                    console.log(`Fixing Sub ${subs[i].id}: #${subs[i].attempt_number} -> #${correctAttempt}`);
                    await connection.execute(`UPDATE submissions SET attempt_number = ? WHERE id = ?`, [correctAttempt, subs[i].id]);
                    fixCount++;
                }
            }
        }

        console.log(`✅ Attempt Number Reconciliation Complete. Fixed ${fixCount} records.`);
    } catch (error) {
        console.error('❌ Reconciliation Failed:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.error('⚠️ Could not connect to DB. Ensure MYSQL is running and accessible at localhost:3306.');
        }
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

fixAttemptNumbers();
