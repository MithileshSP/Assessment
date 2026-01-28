const db = require('./database/connection');

async function migrate() {
    try {
        console.log("Checking for additional_files column...");
        const columns = await db.query("SHOW COLUMNS FROM submissions LIKE 'additional_files'");

        if (columns.length === 0) {
            console.log("Adding additional_files column...");
            await db.query("ALTER TABLE submissions ADD COLUMN additional_files JSON");
            console.log("Column added successfully!");
        } else {
            console.log("Column already exists.");
        }

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

migrate();
