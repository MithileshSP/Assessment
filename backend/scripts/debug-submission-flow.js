const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const SubmissionModel = require('../models/Submission');
const { queryOne } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

async function debugSubmission() {
    console.log('--- Starting Submission Debug ---');

    const challenge = await queryOne('SELECT id FROM challenges LIMIT 1');
    const user = await queryOne('SELECT id FROM users LIMIT 1');

    if (!challenge || !user) {
        console.error('No challenge or user found in DB');
        process.exit(1);
    }
    console.log('Using Challenge:', challenge.id);
    console.log('Using User:', user.id);

    const mockSubmission = {
        id: uuidv4(),
        challengeId: challenge.id,
        userId: user.id,
        candidateName: 'Debug Candidate',
        code: { html: '<div>test</div>', css: '', js: '' },
        status: 'pending',
        submittedAt: new Date()
    };

    try {
        // 1. Create
        console.log('1. Creating submission...');
        const created = await SubmissionModel.create(mockSubmission);
        console.log('   Created:', created ? 'OK' : 'FAILED');

        // 2. Mock Evaluation
        const mockEvaluation = {
            passed: true,
            structureScore: 100,
            visualScore: 100,
            contentScore: 100,
            finalScore: 100,
            feedback: 'Great job!',
            visual: { screenshots: { candidate: '/path/to/img.png' } }
        };

        // 3. Update
        console.log('2. Updating evaluation...');
        const updated = await SubmissionModel.updateEvaluation(created.id, mockEvaluation);
        console.log('   Updated:', updated ? 'OK' : 'FAILED');

        // 4. Verify Content
        console.log('3. Verifying stored data...');
        if (updated) {
            console.log('   Status:', updated.status);
            console.log('   Result present:', !!updated.result);
            console.log('   Scores:', updated.total_score);
            console.log('   Result JSON:', JSON.stringify(updated.result, null, 2));
        } else {
            console.error('   Cannot verify, update failed.');
        }

        // Cleanup
        await SubmissionModel.delete(created.id);
        console.log('--- Debug Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Error during debug:', error);
        process.exit(1);
    }
}

debugSubmission();
