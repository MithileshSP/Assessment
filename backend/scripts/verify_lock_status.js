
const { query, end } = require('../database/connection');
// const fetch = require('node-fetch'); // Use global fetch
const jwt = require('jsonwebtoken');

const USER_ID = 'user-locked-verify-status';
const COURSE_ID = 'course-fullstack';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function main() {
    console.log("=== Verifying Lock Status Persistence ===");

    try {
        // 1. Setup: Ensure User Exists
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            await query(
                "INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, 'locked-status-user', 'lockedstat@test.com', 'dummyhash', 'student']
            );
        }

        // 2. Setup: Ensure Attendance Record exists and is LOCKED
        await query("DELETE FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
        await query(
            `INSERT INTO test_attendance 
            (user_id, test_identifier, status, locked, is_used, requested_at, approved_at)
            VALUES (?, ?, 'approved', 1, 0, NOW(), NOW())`,
            [USER_ID, COURSE_ID]
        );
        console.log("[SETUP] Created LOCKED attendance record.");

        // 3. Configure Token
        const token = jwt.sign({ id: USER_ID, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

        // 4. Call GET /status
        const url = `http://localhost:7000/api/attendance/status?courseId=${COURSE_ID}&level=1`;
        console.log(`Requesting: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${JSON.stringify(data)}`);

        if (response.status === 200) {
            // 5. Verify Locked Flag in Response
            if (data.locked === true) {
                console.log("✅ PASS: API returned locked: true");
                process.exit(0);
            } else {
                console.log("❌ FAIL: API returned locked: " + data.locked);
                process.exit(1);
            }
        } else {
            console.log("❌ FAIL: API returned error.");
            process.exit(1);
        }

    } catch (error) {
        console.error("Test Error:", error);
        process.exit(1);
    }
}

main();
