
const { query, end } = require('../database/connection');
// const fetch = require('node-fetch'); // Use global fetch
const jwt = require('jsonwebtoken');

const USER_ID = 'user-ghost-lock';
const COURSE_ID = 'course-fullstack'; // Use valid course ID
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function main() {
    console.log("=== Verifying Lock Upsert Logic ===");

    try {
        // 1. Setup: Ensure User Exists
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            await query(
                "INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, 'ghost-user', 'ghost@test.com', 'dummyhash', 'student']
            );
        }

        // 2. Setup: Ensure NO Attendance Record exists
        await query("DELETE FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
        console.log("[SETUP] Cleared attendance for ghost user.");

        // 3. Configure Token
        const token = jwt.sign({ id: USER_ID, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

        // 4. Call POST /lock
        const url = `http://localhost:7000/api/attendance/lock`;
        console.log(`Requesting: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courseId: COURSE_ID,
                level: 1,
                reason: 'Ghost Lock Test',
                violationCount: 5
            })
        });

        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${JSON.stringify(data)}`);

        if (response.status === 200 && data.success) {
            // 5. Verify Record Created
            const record = await query("SELECT locked, locked_reason FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
            if (record.length > 0 && record[0].locked === 1) {
                console.log("✅ PASS: Locked record created successfully.");
                process.exit(0);
            } else {
                console.log("❌ FAIL: Record not created or not locked.");
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
