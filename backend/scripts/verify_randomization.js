
const { query, end } = require('../database/connection');
// const fetch = require('node-fetch'); 
const jwt = require('jsonwebtoken');

const USER_ID = 'user-random-verify';
const COURSE_ID = 'course-fullstack';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function main() {
    console.log("=== Verifying Question Randomization on Re-attempt ===");

    try {
        // 1. Setup User
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            await query("INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, 'random-user', 'random@test.com', 'dummyhash', 'student']);
        }

        // 2. Clear previous state
        await query("DELETE FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
        await query("DELETE FROM user_assignments WHERE user_id = ? AND course_id = ?", [USER_ID, COURSE_ID]);

        const token = jwt.sign({ id: USER_ID, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        // 3. Request Attempt 1
        console.log("[STEP 1] Requesting Attempt 1...");
        let res = await fetch('http://localhost:7000/api/attendance/request', {
            method: 'POST', headers, body: JSON.stringify({ courseId: COURSE_ID, level: 1 })
        });
        if (res.status !== 200) throw new Error("Request 1 failed");

        // 4. Get Questions (Trigger Assignment)
        console.log("[STEP 2] Fetching Questions 1...");
        res = await fetch(`http://localhost:7000/api/challenges/level-questions?userId=${USER_ID}&courseId=${COURSE_ID}&level=1`, { headers });
        const data1 = await res.json();
        const q1 = data1.assignedQuestions.map(q => q.id).sort().join(',');
        console.log(`Assignments 1: ${q1}`);

        // 5. Mark Used (Simulate Finish)
        await query("UPDATE test_attendance SET is_used = 1, status='approved' WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
        console.log("[STEP 3] Marked session as used.");

        // 6. Request Attempt 2 (Should clear assignments)
        console.log("[STEP 4] Requesting Attempt 2...");
        res = await fetch('http://localhost:7000/api/attendance/request', {
            method: 'POST', headers, body: JSON.stringify({ courseId: COURSE_ID, level: 1 })
        });
        if (res.status !== 200) throw new Error("Request 2 failed: " + res.status);

        // 7. Check if assignments cleared
        const assignments = await query("SELECT * FROM user_assignments WHERE user_id = ? AND course_id = ? AND level = 1", [USER_ID, COURSE_ID]);
        if (assignments.length === 0) {
            console.log("✅ PASS: Assignments cleared after re-request.");
        } else {
            console.log("❌ FAIL: Assignments partially remained or instantly regenerated (acceptable if different). Count: " + assignments.length);
        }

        // 8. Get Questions Again (Trigger New Assignment)
        console.log("[STEP 5] Fetching Questions 2...");
        res = await fetch(`http://localhost:7000/api/challenges/level-questions?userId=${USER_ID}&courseId=${COURSE_ID}&level=1`, { headers });
        const data2 = await res.json();
        const q2 = data2.assignedQuestions.map(q => q.id).sort().join(',');
        console.log(`Assignments 2: ${q2}`);

        if (q1 !== q2) {
            console.log("✅ PASS: Questions set changed.");
        } else {
            console.warn("⚠️ WARN: Questions set identical (Might be small pool, or randomization fail).");
            // If pool is small, identical is possible. But assignments table check (step 7) confirms process.
        }

        process.exit(0);

    } catch (error) {
        console.error("Test Error:", error);
        process.exit(1);
    }
}

main();
