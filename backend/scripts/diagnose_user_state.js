require('dotenv').config({ path: '../.env' });
const { query } = require('../database/connection');

async function diagnose() {
    console.log("--- Randomization Logic Diagnosis ---");

    const username = process.argv[2] || 'student1';
    const courseId = 'course-fullstack';
    const level = 1;

    try {
        console.log(`Checking state for User: ${username}, Course: ${courseId}, Level: ${level}`);

        // 1. Get User ID
        const users = await query("SELECT id, username FROM users WHERE username = ? OR email = ?", [username, username]);
        if (users.length === 0) {
            console.error("❌ User not found!");
            process.exit(1);
        }
        const user = users[0];
        console.log(`✅ User Found: ${user.username} (${user.id})`);

        // 2. Get Active Assignments
        const assignments = await query(
            `SELECT * FROM challenge_assignments 
             WHERE user_id = ? AND course_id = ? AND level = ? AND status = 'active'
             ORDER BY assigned_at DESC`,
            [user.id, courseId, level]
        );

        console.log(`\n--- Active Assignments (${assignments.length}) ---`);
        if (assignments.length === 0) {
            console.log("⚠️ No active assignment found. (System should assign a new one automatically on next request)");
            process.exit(0);
        }

        assignments.forEach((a, i) => {
            console.log(`${i + 1}. ID: ${a.id} | Question: ${a.challenge_id} | Assigned: ${a.assigned_at}`);
        });

        const currentAssignment = assignments[0];
        const qId = currentAssignment.challenge_id; // challenge_id or assignedQuestions logic
        console.log(`\n👉 Current Effective Assignment: ${qId}`);

        // 3. Check Submissions for this Question
        const submissions = await query(
            `SELECT id, status, passed, submitted_at 
             FROM submissions 
             WHERE user_id = ? AND challenge_id = ? AND status != 'saved'
             ORDER BY submitted_at DESC`,
            [user.id, qId]
        );

        console.log(`\n--- Submissions for Question ${qId} ---`);
        if (submissions.length === 0) {
            console.log("❌ No submissions found (excluding drafts).");
            console.log("   -> Logic: 'No previous submission found' -> isStale = FALSE");
            console.log("   -> Result: User stays on this question.");
        } else {
            submissions.forEach((s, i) => {
                console.log(`${i + 1}. ID: ${s.id} | Status: ${s.status} | Passed: ${s.passed} | Time: ${s.submitted_at}`);
            });

            const latest = submissions[0];
            console.log(`\n--- Logic Check (on Latest Submission) ---`);
            console.log(`   Status: '${latest.status}'`);
            console.log(`   Passed: ${latest.passed}`);

            const isNonPassing = !latest.passed || latest.passed === 0;
            const isStaleStatus = ['evaluated', 'failed', 'queued', 'evaluating', 'pending'].includes(latest.status);

            console.log(`   -> isNonPassing (!passed || === 0): ${isNonPassing}`);
            console.log(`   -> isStaleStatus (in list): ${isStaleStatus}`);

            if (isStaleStatus && isNonPassing) {
                console.log(`✅ CONCLUSION: Logic SHOULD detect this as STALE and re-assign.`);
            } else {
                console.log(`❌ CONCLUSION: Logic will NOT re-assign. (isStale = FALSE)`);
            }
        }

    } catch (err) {
        console.error("Diagnosis failed:", err);
    } finally {
        process.exit();
    }
}

diagnose();
