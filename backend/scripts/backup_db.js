const fs = require('fs');
const path = require('path');
const { pool, USE_JSON } = require('../database/connection');

// Tables to backup in order of dependency
const TABLES = [
    'users',
    'courses',
    'challenges',
    'submissions',
    'user_progress',
    'user_assignments',
    'assets',
    'level_completions',
    'activity_logs'
];

async function backup() {
    console.log('📦 Starting Database Backup...');

    if (USE_JSON) {
        console.log('⚠️  Using JSON storage mode. Database files are already in backend/data. You can just share the "backend/data" folder!');
        process.exit(0);
    }

    let sqlContent = `-- Database Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

    // Disable foreign key checks for import
    sqlContent += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

    try {
        for (const table of TABLES) {
            console.log(`Processing table: ${table}...`);

            // Get table data
            const [rows] = await pool.query(`SELECT * FROM ${table}`);

            if (rows.length > 0) {
                sqlContent += `-- Data for table ${table}\n`;
                sqlContent += `TRUNCATE TABLE ${table};\n`;

                // Chunk inserts to avoid massive statements
                const CHUNK_SIZE = 100;
                for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                    const chunk = rows.slice(i, i + CHUNK_SIZE);

                    const values = chunk.map(row => {
                        const rowValues = Object.values(row).map(val => {
                            if (val === null) return 'NULL';
                            if (typeof val === 'number') return val;
                            if (typeof val === 'boolean') return val ? 1 : 0;
                            // Escape single quotes and backslashes
                            const strInfo = typeof val === 'object' ? JSON.stringify(val) : String(val);
                            return `'${strInfo.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
                        });
                        return `(${rowValues.join(', ')})`;
                    });

                    sqlContent += `INSERT INTO ${table} (${Object.keys(chunk[0]).join(', ')}) VALUES ${values.join(', ')};\n`;
                }
                sqlContent += '\n';
            } else {
                console.log(`  (Empty table)`);
            }
        }

        // Re-enable foreign key checks
        sqlContent += 'SET FOREIGN_KEY_CHECKS = 1;\n';

        const outputPath = path.join(__dirname, '..', 'full_backup.sql');
        fs.writeFileSync(outputPath, sqlContent);

        console.log('\n✅ Backup successfully created!');
        console.log(`📁 File location: ${outputPath}`);
        console.log('👉 You can send this file to your teammate. They can import it into their MySQL database.');

    } catch (error) {
        console.error('❌ Backup failed:', error);
    } finally {
        // Keep connection open for a moment to ensure logs flush? No, just exit.
        process.exit();
    }
}

backup();
