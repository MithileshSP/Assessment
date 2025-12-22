const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const TestSession = require('../models/TestSession');
const SubmissionModel = require('../models/Submission');
const { queryOne } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

async function debugSession() {
    console.log('--- Starting Session Debug ---');

    // Fetch valid IDs
    const challenge = await queryOne('SELECT id FROM challenges LIMIT 1');
    const user = await queryOne('SELECT id FROM users LIMIT 1');
    const course = await queryOne('SELECT id FROM courses LIMIT 1');

    if (!challenge || !user || !course) {
        console.error('Missing required DB data (challenge/user/course)');
        process.exit(1);
    }
    console.log('Using Challenge:', challenge.id);
    console.log('Using User:', user.id);
    console.log('Using Course:', course.id);

    const submissionId = uuidv4();
    try {
        // Setup: Create a submission first
        await SubmissionModel.create({
            id: submissionId,
            challengeId: challenge.id,
            userId: user.id,
            code: { html: 'test' },
            status: 'passed'
        });
        // Manually ensure it's passed
        await SubmissionModel.updateEvaluation(submissionId, {
            passed: true,
            finalScore: 100
        });

        // 1. Create Session
        console.log('1. Creating session...');
        const session = await TestSession.create({
            user_id: user.id,
            course_id: course.id,
            level: 1
        });
        console.log('   Created Session ID:', session.id);

        // 2. Add Submission
        console.log('2. Adding submission...');
        const updatedSession = await TestSession.addSubmission(session.id, submissionId);
        console.log('   Submission IDs after add:', updatedSession.submission_ids);

        // 3. Complete Session
        console.log('3. Completing session...');
        const completedSession = await TestSession.complete(session.id, { user_feedback: 'good' });
        console.log('   Completed At:', completedSession.completed_at);
        console.log('   Total Questions:', completedSession.total_questions);
        console.log('   Passed Count:', completedSession.passed_count);
        console.log('   Overall Status:', completedSession.overall_status);

        if (completedSession.total_questions === 0) {
            console.error('❌ FAIL: Total questions is 0, expected 1');
        } else if (completedSession.passed_count === 0) {
            console.error('❌ FAIL: Passed count is 0, expected 1');
        } else {
            console.log('✅ SUCCESS: Counts look correct.');
        }

        // Cleanup
        await SubmissionModel.delete(submissionId);
        // Note: We might want to delete session too but model doesn't support it yet
        console.log('--- Debug Complete ---');
        process.exit(0);

    } catch (error) {
        console.error('Error during debug:', error);
        // Try cleanup
        try { await SubmissionModel.delete(submissionId); } catch (e) { }
        process.exit(1);
    }
}

debugSession();
