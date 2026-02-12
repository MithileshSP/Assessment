
const { query, end } = require('../database/connection');
// const fetch = require('node-fetch'); // Use global fetch
const jwt = require('jsonwebtoken');

const USER_ID = 'user-submitted-lock';
const COURSE_ID = 'course-fullstack';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function main() {
    console.log("=== Verifying Lock on Submitted Test ===");

    try {
        // 1. Setup: Ensure User Exists
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            await query(
                "INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, 'submitted-user', 'submitted@test.com', 'dummyhash', 'student']
            );
        }

        // 2. Setup: Ensure Attendance Record exists AND is submitted (is_used=1)
        await query("DELETE FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
        await query(
            `INSERT INTO test_attendance 
            (user_id, test_identifier, status, locked, is_used, requested_at, approved_at)
            VALUES (?, ?, 'approved', 0, 1, NOW(), NOW())`,
            [USER_ID, COURSE_ID]
        );
        console.log("[SETUP] Created submitted attendance record.");

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
                reason: 'Violation after submit',
                violationCount: 10
            })
        });

        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${JSON.stringify(data)}`);

        if (response.status === 200 && data.success) {
            // 5. Verify Record Locked
            const record = await query("SELECT locked, locked_reason FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
            if (record.length > 0 && record[0].locked === 1) {
                console.log("✅ PASS: Submitted test successfully locked.");
                process.exit(0);
            } else {
                console.log("❌ FAIL: Record not locked in DB.");
                process.exit(1);
            }
        } else {
            console.log("❌ FAIL: API returned error (expected 200).");
            process.exit(1);
        }

    } catch (error) {
        console.error("Test Error:", error);
        process.exit(1);
    }
}

main();
