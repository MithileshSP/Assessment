/**
 * Recovery Diagnostic Script
 * Checks for missing submissions in activity_logs and BullMQ failed jobs
 */

const Redis = require('ioredis');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);

// MySQL configuration (connecting via host port 3307 as seen in docker-compose)
const dbConfig = {
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: 'gokul',
  database: 'fullstack_test_portal'
};

async function checkRecovery() {
  console.log('--- RECOVERY DIAGNOSTIC ---');
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL');

    // 1. Find the deleted challenge ID
    console.log('\n--- Searching for Deleted Challenge Logs ---');
    const [deletedLogs] = await connection.execute(
      "SELECT * FROM activity_logs WHERE action = 'delete' AND entity_type = 'challenge' AND DATE(created_at) = '2026-03-23' ORDER BY created_at DESC"
    );
    console.log(`Found ${deletedLogs.length} challenge deletions on 23/03/26`);
    deletedLogs.forEach(log => {
        console.log(`- Deleted Entity ID: ${log.entity_id}, Time: ${log.created_at}, Details: ${log.details}`);
    });

    const oldChallengeId = deletedLogs.length > 0 ? deletedLogs[0].entity_id : null;

    // 2. Search for submissions in activity_logs
    console.log('\n--- Searching for Submissions in Activity Logs ---');
    // Using a broader date range just in case
    const [subLogs] = await connection.execute(
      "SELECT * FROM activity_logs WHERE (action = 'submit' OR action = 'save') AND DATE(created_at) = '2026-03-23' ORDER BY created_at DESC LIMIT 20"
    );
    console.log(`Found ${subLogs.length} submission/save activities in logs (sample shown)`);
    subLogs.forEach(log => {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        console.log(`- Action: ${log.action}, User: ${log.user_id}, Challenge: ${details?.challengeId || 'N/A'}, Time: ${log.created_at}`);
    });

  } catch (err) {
    console.error('❌ MySQL Diagnostic Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }

  // 3. Check BullMQ failed jobs
  try {
    console.log('\n--- Searching for Failed Jobs in Redis ---');
    const queueName = 'bull:submission_db_queue';
    
    // BullMQ stores failed job IDs in a set: bull:submission_db_queue:failed
    const failedJobIds = await redis.zrange(`${queueName}:failed`, 0, -1);
    console.log(`Found ${failedJobIds.length} failed jobs in submission_db_queue`);

    let recoveredCount = 0;
    for (const jobId of failedJobIds) {
        const jobData = await redis.hget(`${queueName}:${jobId}`, 'data');
        if (jobData) {
            const data = JSON.parse(jobData);
            // Search for date 23/03/26 or challengeId
            if (data.submittedAt && data.submittedAt.includes('2026-03-23')) {
                console.log(`FOUND POTENTIAL RECOVERY: Job ${jobId}, User ${data.userId}, Challenge ${data.challengeId}, Time ${data.submittedAt}`);
                recoveredCount++;
                if (recoveredCount < 5) {
                    console.log(`Sample Code Snippet (JS): ${data.code?.js?.substring(0, 100)}...`);
                }
            }
        }
    }
    console.log(`\nTotal potentially recoverable submissions found in Redis: ${recoveredCount}`);

  } catch (err) {
    console.error('❌ Redis Diagnostic Error:', err.message);
  } finally {
    redis.quit();
  }
}

checkRecovery();
