
const { query, queryOne } = require('../database/connection');
const TestSession = require('../models/TestSession');
const { v4: uuidv4 } = require('uuid');

const USER_ID = 'user-autosave-test-' + Date.now();
const COURSE_ID = 'course-fullstack';
const CHALLENGE_ID = 'course-javascript-l1-q1769575925587';

async function main() {
    console.log("=== Verifying Auto-Save Draft Promotion ===");

    try {
        // 1. Setup User
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            const username = 'autosave-user-' + Date.now();
            await query("INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, username, `autosave${Date.now()}@test.com`, 'dummyhash', 'student']);
        }

        // 2. Create a session
        const session = await TestSession.create({
            user_id: USER_ID,
            course_id: COURSE_ID,
            level: 1
        });
        console.log(`Created test session: ${session.id}`);

        // 3. Create a DRAFT submission (status = 'saved')
        const draftId = uuidv4();
        await query(
            `INSERT INTO submissions (id, challenge_id, user_id, html_code, css_code, js_code, status, course_id, level)
             VALUES (?, ?, ?, 'testing-html', 'testing-css', 'testing-js', 'saved', ?, 1)`,
            [draftId, CHALLENGE_ID, USER_ID, COURSE_ID]
        );
        console.log(`Created draft submission: ${draftId}`);

        // 4. Complete the session (this should trigger promotion)
        console.log("[STEP] Completing session...");
        await TestSession.complete(session.id);

        // 5. Verify the draft was promoted
        const promoted = await queryOne("SELECT status FROM submissions WHERE id = ?", [draftId]);
        if (promoted.status === 'queued' || promoted.status === 'passed' || promoted.status === 'failed' || promoted.status === 'evaluating') {
            console.log(`✅ PASS: Draft status updated to: ${promoted.status}`);
        } else {
            console.log(`❌ FAIL: Draft status is still: ${promoted.status}`);
        }

        // 6. Verify session submission_ids includes the draft ID
        const finalizedSession = await queryOne("SELECT submission_ids FROM test_sessions WHERE id = ?", [session.id]);
        const subIds = finalizedSession.submission_ids || [];
        if (subIds.includes(draftId)) {
            console.log("✅ PASS: Draft ID linked to session submission_ids.");
        } else {
            console.log("❌ FAIL: Draft ID NOT linked to session.");
            console.log("Found IDs:", subIds);
        }

        process.exit(0);

    } catch (error) {
        console.error("Test Error:", error);
        process.exit(1);
    }
}

main();
