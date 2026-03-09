const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Use REDIS_URL from env or fallback to local redis
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Create the AI grading queue
const aiGradingQueue = new Queue('ai_grading_queue', { connection: redisConnection });

/**
 * Pushes a submission to the AI grading queue.
 * @param {string} submissionId - The ID from the submissions table
 * @param {string} assignmentId - The ID from the submission_assignments table
 */
async function addSubmissionToAiQueue(submissionId, assignmentId) {
    try {
        const job = await aiGradingQueue.add(
            'grade_submission',
            { submissionId, assignmentId },
            {
                attempts: 1, // Enterprise best practice: Manual retries only
                removeOnComplete: true,
                removeOnFail: false
            }
        );
        console.log(`[AI Queue] Job added for submission ${submissionId} (Job ID: ${job.id})`);
        return job;
    } catch (error) {
        console.error(`[AI Queue] Failed to add job for submission ${submissionId}:`, error);
        throw error;
    }
}

module.exports = {
    addSubmissionToAiQueue,
    aiGradingQueue,
    redisConnection
};
