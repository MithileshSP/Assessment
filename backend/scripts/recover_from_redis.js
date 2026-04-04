const Redis = require('ioredis');
require('dotenv').config({ path: '../.env' });

/**
 * RECOVERY SCRIPT: Extracts submission data from BullMQ Redis storage.
 * Run this inside the backend container to recover "lost" submissions.
 * 
 * Usage: node scripts/recover_from_redis.js [output_file.json]
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://portal_redis:6379';
const redis = new Redis(REDIS_URL);
const outputFile = process.argv[2] || 'recovered_submissions_redis.json';

async function recover() {
    console.log(`🔍 Connecting to Redis at ${REDIS_URL}...`);
    
    try {
        // BullMQ stores job data in various keys. 
        // We'll scan for all job data in the 'submission_db_queue'
        const queueName = 'submission_db_queue';
        const jobKeyPattern = `bull:${queueName}:*`;
        
        console.log(`📡 Scanning for keys matching ${jobKeyPattern}...`);
        
        const keys = await redis.keys(jobKeyPattern);
        console.log(`Found ${keys.length} keys in total for this queue.`);

        const recoveredData = [];
        const seenSubmissionIds = new Set();

        for (const key of keys) {
            // We are looking for the 'data' field in hash keys like bull:submission_db_queue:<id>
            const type = await redis.type(key);
            if (type === 'hash') {
                const jobDataRaw = await redis.hget(key, 'data');
                if (jobDataRaw) {
                    try {
                        const jobData = JSON.parse(jobDataRaw);
                        // BullMQ submission jobs usually have the submission data in the root or 'submission' field
                        const submission = jobData.submission || jobData;

                        if (submission && submission.id && !seenSubmissionIds.has(submission.id)) {
                            // Filter for the affected dates (March 23-26, 2026)
                            const submittedAt = new Date(submission.submitted_at || Date.now());
                            if (submittedAt.getMonth() === 2 && submittedAt.getDate() >= 20) { // March is 2
                                recoveredData.push(submission);
                                seenSubmissionIds.add(submission.id);
                            }
                        }
                    } catch (e) {
                        // Not a JSON or invalid job data
                    }
                }
            }
        }

        console.log(`✅ Recovery complete! Found ${recoveredData.length} unique submissions from the target period.`);
        
        if (recoveredData.length > 0) {
            const fs = require('fs');
            fs.writeFileSync(outputFile, JSON.stringify(recoveredData, null, 2));
            console.log(`💾 Saved recovered data to ${outputFile}`);
            console.log(`\nNext steps:`);
            console.log(`1. Inspect the JSON file to verify the content.`);
            console.log(`2. Use a restore script or manual SQL to re-insert the records.`);
        } else {
            console.log("ℹ️ No submissions found in the current Redis state for the target period.");
        }

    } catch (err) {
        console.error("❌ Recovery failed:", err.message);
    } finally {
        redis.disconnect();
        process.exit(0);
    }
}

recover();
