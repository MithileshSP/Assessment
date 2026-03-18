const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Shared Redis connection for queues
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null // Required for BullMQ
});

// Create the submission database queue with DLQ support
const submissionDbQueue = new Queue('submission_db_queue', { 
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 5000 // 5s, 10s, 20s, 40s, 80s
        },
        removeOnComplete: true,
        removeOnFail: false // Keep in DLQ for manual audit
    }
});

const MAX_QUEUE_SIZE = 3000;

/**
 * Pushes a new submission to the database persistence queue.
 * Includes backpressure protection.
 */
async function addSubmissionToDbQueue(submissionData) {
    try {
        // OPTIMIZED BACKPRESSURE CHECK (O(1) in Redis)
        const waitingCount = await submissionDbQueue.getWaitingCount();
        if (waitingCount > MAX_QUEUE_SIZE) {
            console.warn(`⚠️ [Backpressure] Submission queue full (${waitingCount}). Rejecting request.`);
            const error = new Error('System is currently under heavy load. Please try again in a few seconds.');
            error.statusCode = 503;
            throw error;
        }

        const job = await submissionDbQueue.add(
            'persist_submission',
            submissionData,
            {
                jobId: `sub_${submissionData.userId}_${submissionData.challengeId}`, // IDEMPOTENCY AT QUEUE LEVEL
            }
        );
        
        console.log(`[Submission Queue] Job added: ${job.id}`);
        return job;
    } catch (error) {
        if (error.statusCode !== 503) {
            console.error(`[Submission Queue] Critical error for ${submissionData.id}:`, error);
        }
        throw error;
    }
}

module.exports = {
    addSubmissionToDbQueue,
    submissionDbQueue,
    redisConnection
};
