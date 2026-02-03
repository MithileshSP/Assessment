const { query } = require('./database/connection');

async function test() {
    console.log('Testing manual insert...');
    try {
        const id = 'test-sub-' + Date.now();
        await query(
            `INSERT INTO submissions (id, challenge_id, user_id, course_id, level, candidate_name, html_code, css_code, js_code, status, submitted_at, additional_files)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
            [id, 'test-ch', 'test-user', 'test-course', 1, 'Tester', 'test', 'test', 'test', 'queued', '{}']
        );
        console.log('Insert successful, ID:', id);
        const result = await query("SELECT * FROM submissions WHERE id = ?", [id]);
        console.log('Verify result:', result);
        process.exit(0);
    } catch (e) {
        console.error('Insert failed:', e.message);
        process.exit(1);
    }
}

test();
