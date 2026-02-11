const fs = require('fs');
const path = require('path');
const { query } = require('./database/connection');
require('dotenv').config();

const jsonPath = path.join(__dirname, 'data/challenges-new.json');

async function checkCounts() {
    console.log('--- Checking Question Counts ---\n');

    // 1. Check JSON
    try {
        const data = fs.readFileSync(jsonPath, 'utf8');
        const challenges = JSON.parse(data);
        const fullstackJson = challenges.filter(c => c.courseId === 'course-fullstack' || c.course_id === 'course-fullstack');
        console.log(`[JSON] Total Challenges: ${challenges.length}`);
        console.log(`[JSON] 'course-fullstack': ${fullstackJson.length}`);
        if (fullstackJson.length > 0) {
            console.log(`[JSON] Sample IDs: ${fullstackJson.slice(0, 3).map(c => c.id).join(', ')}`);
        }
    } catch (e) {
        console.error('[JSON] Error reading file:', e.message);
    }

    // 2. Check DB
    try {
        const dbChallenges = await query("SELECT id, course_id, title FROM challenges WHERE course_id = 'course-fullstack'");
        console.log(`\n[DB] 'course-fullstack': ${dbChallenges.length}`);
        if (dbChallenges.length > 0) {
            console.log(`[DB] Sample IDs: ${dbChallenges.slice(0, 3).map(c => c.id).join(', ')}`);
        }
    } catch (e) {
        console.error('[DB] Error querying:', e.message);
    }

    process.exit();
}

checkCounts();
