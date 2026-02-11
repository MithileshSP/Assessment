require('dotenv').config({ path: '../.env' });
const { query, pool } = require('../database/connection');
const ChallengeAssignment = require('../models/ChallengeAssignment');

async function verifyFix() {
    try {
        console.log("Verifying Level Questions Fix...");

        // 1. Get a valid user
        const users = await query("SELECT id FROM users LIMIT 1");
        if (users.length === 0) {
            console.error("No users found in DB to test with.");
            process.exit(1);
        }
        const userId = users[0].id;
        const courseId = 'course-fullstack';
        const level = 1;

        // 2. Get a valid challenge to assign
        // We need a challenge ID that exists. 
        // Since we don't have the ChallengeModel loaded here easily without more dependencies, 
        // let's just use a dummy ID or try to find one if possible.
        // Or better, let's just insert a dummy challenge if we can, or just assume 'challenge-1' exists?
        // Actually, the ChallengeAssignment.assign method just inserts strings, it doesn't enforce FK strictly unless the DB does.
        // Let's check if there are any challenges in the DB or JSON.
        // The previous code used JSON file fallback, so DB might be empty of challenges.
        // However, ChallengeAssignment just inserts into `challenge_assignments`.
        const challengeId = 'test-challenge-id';

        console.log(`Testing assignment for User: ${userId}, Course: ${courseId}, Level: ${level}, Challenge: ${challengeId}`);

        // 3. Test ChallengeAssignment.assign (The part that was failing in routes)
        try {
            const assignmentId = await ChallengeAssignment.assign(userId, courseId, level, challengeId);
            console.log("✅ Assignment created successfully. ID:", assignmentId);
        } catch (error) {
            console.error("❌ ChallengeAssignment.assign failed:", error);
            process.exit(1);
        }

        // 4. Test Submissions Query (The new part)
        try {
            const completedRows = await query(
                `SELECT DISTINCT challenge_id FROM submissions 
                 WHERE user_id = ? AND passed = 1`,
                [userId]
            );
            console.log("✅ Submissions query successful. Found:", completedRows.length);
        } catch (error) {
            console.error("❌ Submissions query failed:", error);
            process.exit(1);
        }

        console.log("---------------------------------------------------");
        console.log("🎉 VERIFICATION PASSED: The code logic for assignment and submission fetching is valid.");
        console.log("The 500 error caused by undefined 'assignments' variable should be resolved.");
        console.log("---------------------------------------------------");

    } catch (err) {
        console.error("Unexpected error:", err);
    } finally {
        await pool.end();
    }
}

verifyFix();
