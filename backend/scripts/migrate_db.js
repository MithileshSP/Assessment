const mysql = require('mysql2/promise');

// Configuration
const SOURCE_DB = {
    host: 'host.docker.internal',
    port: 3306,
    user: 'root',
    password: 'gokul',
    database: 'fullstack_test_portal'
};

const TARGET_DB = {
    host: 'host.docker.internal',
    port: 3307,
    user: 'root',
    password: 'gokul',
    database: 'fullstack_test_portal'
};

const TABLES = [
    'users',
    'courses',
    'challenges',
    'submissions',
    'test_sessions',
    'assets',
    'level_completions'
];

async function migrate() {
    let sourceConn, targetConn;
    try {
        console.log('Connecting to Source DB (Host:3306)...');
        sourceConn = await mysql.createConnection(SOURCE_DB);

        console.log('Connecting to Target DB (Docker:3307)...');
        targetConn = await mysql.createConnection(TARGET_DB);

        // Disable foreign key checks on target
        await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of TABLES) {
            console.log(`Migrating table: ${table}...`);

            // Check if table exists in source
            try {
                const [rows] = await sourceConn.query(`SELECT * FROM ${table}`);
                if (rows.length === 0) {
                    console.log(`  - No data in ${table}, skipping.`);
                    continue;
                }

                console.log(`  - Found ${rows.length} rows.`);

                // Clear target table (optional, but safer to assume we want a clone)
                // await targetConn.query(`TRUNCATE TABLE ${table}`); // Truncate can be risky with FKs even if disabled
                await targetConn.query(`DELETE FROM ${table}`);

                // Insert data
                // We construct the INSERT statement dynamically
                if (rows.length > 0) {
                    const keys = Object.keys(rows[0]);
                    const placeholders = keys.map(() => '?').join(', ');
                    const columns = keys.map(k => `\`${k}\``).join(', ');

                    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

                    for (const row of rows) {
                        const values = Object.values(row).map(v => {
                            // Handle JSON fields (objects/arrays) ensuring they are stringified
                            if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
                                return JSON.stringify(v);
                            }
                            return v;
                        });
                        await targetConn.execute(sql, values);
                    }
                    console.log(`  - Inserted ${rows.length} rows.`);
                }

            } catch (err) {
                console.warn(`  - Error processing ${table}: ${err.message}`);
            }
        }

        console.log('Migration complete.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (targetConn) await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
        if (sourceConn) await sourceConn.end();
        if (targetConn) await targetConn.end();
    }
}

migrate();
