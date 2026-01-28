const db = require('./database/connection');

async function check() {
    try {
        console.log("Fetching latest submissions...");
        const submissions = await db.query("SELECT id, candidate_name, additional_files FROM submissions ORDER BY submitted_at DESC LIMIT 5");
        console.log(JSON.stringify(submissions, null, 2));
    } catch (err) {
        console.error("Check failed:", err);
    } finally {
        process.exit();
    }
}

check();
