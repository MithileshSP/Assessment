require('dotenv').config({ path: __dirname + '/.env' }); // Load env vars
// Override for local execution against Docker
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';

const { applyMigrations } = require('./services/dbMigration');


async function run() {
    try {
        console.log('Running migrations manually...');
        await applyMigrations();
        console.log('Migrations completed.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
