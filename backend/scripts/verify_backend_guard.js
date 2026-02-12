const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const TEST_CONFIG = {
    baseUrl: 'http://localhost:7000/api',
    secret: 'development_secret_key_change_in_production'
};

const USER_ID = 'user-locked-verify';
const COURSE_ID = 'course-fullstack';

async function main() {
    console.log(`${colors.cyan}=== Verifying Backend API Guard ===${colors.reset}`);

    try {
        // 1. Seed Locked Record
        console.log(`[SETUP] Seeding locked record for ${USER_ID} on ${COURSE_ID}...`);

        // Ensure user exists (hack: using existing ID or inserting)
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            await query(
                "INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, 'locked-user', 'locked@test.com', 'dummyhash123', 'student']
            );
        }

        // Insert/Update Attendance to be LOCKED
        await query(
            `INSERT INTO test_attendance (
                user_id, test_identifier, status, locked, locked_reason, requested_at, approved_at
            ) VALUES (?, ?, 'approved', 1, 'Manual Lock', NOW(), NOW())
            ON DUPLICATE KEY UPDATE locked=1, status='approved'`,
            [USER_ID, COURSE_ID]
        );
        console.log(`[SETUP] Record seeded.`);

        // 2. Generate Token
        const token = jwt.sign(
            {
                id: USER_ID,
                username: 'locked-user',
                role: 'student'
            },
            TEST_CONFIG.secret,
            { expiresIn: '1h' }
        );

        // 3. Call Protected Endpoint
        const url = `${TEST_CONFIG.baseUrl}/challenges/level-questions?courseId=${COURSE_ID}&level=1`;
        console.log(`Requesting: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Status: ${response.status}`);

        if (response.status === 403) {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data));
            if (data.locked === true) {
                console.log(`${colors.green}PASS: Access Denied due to Lock.${colors.reset}`);
                process.exit(0);
            } else {
                console.log(`${colors.red}FAIL: 403 but locked flag missing/false.${colors.reset}`);
                process.exit(1);
            }
        } else {
            console.log(`${colors.red}FAIL: Expected 403, got ${response.status}${colors.reset}`);
            const text = await response.text();
            console.log('Body:', text);
            process.exit(1);
        }

    } catch (e) {
        console.error(`${colors.red}Error:${colors.reset}`, e.message);
        process.exit(1);
    }
}

main();
