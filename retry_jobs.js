const { Queue } = require('bullmq');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

async function retryFailedJobs() {
    try {
        const queue = new Queue('submission_db_queue', { connection });
        const failedJobs = await queue.getFailed();
        
        console.log(`📡 Found ${failedJobs.length} failed jobs in 'submission_db_queue'`);
        
        for (const job of failedJobs) {
            console.log(`🔄 Retrying job: ${job.id} (Error: ${job.failedReason})`);
            await job.retry();
        }
        
        console.log('✅ All failed jobs have been retried.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Retry failed:', error.message);
        process.exit(1);
    }
}

retryFailedJobs();
