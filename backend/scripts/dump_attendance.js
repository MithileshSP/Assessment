const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force local connection parameters for host-side script
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
process.env.DB_PASSWORD = 'gokul';

const { query } = require('../database/connection');

async function explorer() {
    console.log('🔍 Exploring MySQL instance...');
    try {
        const [dbs] = await query("SHOW DATABASES");
        for (const dbRow of dbs) {
            const dbName = dbRow.Database;
            console.log(`\nDB: ${dbName}`);
            try {
                const tables = await query(`SHOW TABLES FROM \`${dbName}\``);
                console.log(`  Tables: ${tables.length}`);
                if (dbName === 'fullstack_test_portal' || dbName === 'Assessment') {
                    for (const t of tables) {
                        const tableName = t[`Tables_in_${dbName}`];
                        const count = await query(`SELECT COUNT(*) as c FROM \`${dbName}\`.\`${tableName}\``);
                        console.log(`    - ${tableName}: ${count[0].c} rows`);
                    }
                }
            } catch (e) {
                console.log(`  Error listing tables: ${e.message}`);
            }
        }
    } catch (e) {
        console.error('Explorer failed:', e.message);
    } finally {
        process.exit(0);
    }
}

explorer();
