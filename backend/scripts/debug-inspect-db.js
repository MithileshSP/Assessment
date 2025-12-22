const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../database/connection');

async function inspectDb() {
    console.log('--- Inspecting Recent Test Sessions ---');
    try {
        const sessions = await query('SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT 5');

        if (sessions.length === 0) {
            console.log('No test sessions found.');
            process.exit(0);
        }

        for (const session of sessions) {
            console.log(`\nSession ID: ${session.id}`);
            console.log(`User ID: ${session.user_id}`);
            console.log(`Started At: ${session.started_at}`);
            console.log(`Submission IDs (Raw):`, session.submission_ids);
            console.log(`Counts: ${session.passed_count} / ${session.total_questions}`);

            let subIds = [];
            try {
                subIds = typeof session.submission_ids === 'string'
                    ? JSON.parse(session.submission_ids)
                    : session.submission_ids;
            } catch (e) {
                console.log('Error parsing submission_ids');
            }

            if (subIds && subIds.length > 0) {
                console.log('  Checking Submissions:');
                const submissions = await query(`SELECT id, status, passed, final_score FROM submissions WHERE id IN (?)`, [subIds]);
                submissions.forEach(sub => {
                    console.log(`    - ${sub.id}: Status=${sub.status}, Passed=${sub.passed}, Score=${sub.final_score}`);
                });
            } else {
                console.log('  No linked submissions.');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectDb();
