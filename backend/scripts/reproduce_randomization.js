require('dotenv').config({ path: '../.env' });
const { query, pool } = require('../database/connection');
const ChallengeAssignment = require('../models/ChallengeAssignment');

async function reproduce() {
    try {
        const userId = 'user-admin-1';
        const courseId = 'course-fullstack';
        const level = 1;

        console.log("--- Step 1: Create initial assignment ---");
        // Force a known assignment first
        await ChallengeAssignment.assign(userId, courseId, level, 'q-course-fullstack-1-1770191772931-0');

        let currentAssignment = await ChallengeAssignment.findCurrent(userId, courseId, level);
        console.log("Current Assignment ID:", currentAssignment.challenge_id);

        console.log("\n--- Step 2: Simulate Failure ---");
        // Insert a 'pending' submission (simulating DB default or early stage)
        await query(`INSERT INTO submissions (id, user_id, challenge_id, course_id, html_code, status, passed, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [`sub-${Date.now()}`, userId, currentAssignment.challenge_id, courseId, 'code', 'pending', 0]
        );

        console.log("\n--- Step 3: Simulate 'Get Level Questions' call ---");
        // Logic from availability check in challenges.js

        // 1. Get Active Assignment
        let userAssignment = await ChallengeAssignment.findCurrent(userId, courseId, level);

        // Check if stale
        let isStale = false;
        let failedQuestionId = null;

        if (userAssignment) {
            const qId = userAssignment.challenge_id;
            console.log(`Checking if assignment ${qId} is stale...`);

            const [latestSubmission] = await query(
                `SELECT passed, status FROM submissions 
                 WHERE user_id = ? AND challenge_id = ? AND status != 'saved'
                 ORDER BY submitted_at DESC LIMIT 1`,
                [userId, qId]
            );

            if (latestSubmission) {
                console.log(`Submission found: Status=${latestSubmission.status}, Passed=${latestSubmission.passed}`);
                const isStaleStatus = ['evaluated', 'failed', 'queued', 'evaluating', 'pending'].includes(latestSubmission.status);
                if (isStaleStatus && (latestSubmission.passed === 0 || latestSubmission.passed === false)) {
                    console.log("STALE DETECTED");
                    isStale = true;
                    failedQuestionId = qId;
                } else {
                    console.log("NOT STALE (Submitted but passed or not evaluated?)");
                }
            } else {
                console.log("NOT STALE (No submission found)");
            }
        }

        if (isStale) {
            console.log("Re-assigning...");
            // Fetch all questions
            const qs = await query('SELECT id FROM challenges WHERE course_id = ?', [courseId]);
            let candidateQuestions = qs;

            if (failedQuestionId) {
                candidateQuestions = qs.filter(q => q.id !== failedQuestionId);
                console.log(`Excluded ${failedQuestionId}. Candidates left: ${candidateQuestions.length}`);
            }

            const shuffled = [...candidateQuestions].sort(() => 0.5 - Math.random());
            const selected = shuffled[0];
            console.log("Selected New Question:", selected.id);

            if (selected.id === 'q-course-fullstack-1-1770191772931-0') {
                console.error("❌ FAILED: Selected the same question again!");
            } else {
                console.log("✅ SUCCESS: Selected a different question.");
            }
        } else {
            console.error("❌ FAILED: Did not detect stale assignment.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

reproduce();
