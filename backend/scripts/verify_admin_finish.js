
const { query, queryOne } = require('../database/connection');
const TestSession = require('../models/TestSession');

const USER_ID = 'user-admin-finish-test';
const COURSE_ID = 'course-fullstack';

async function main() {
    console.log("=== Verifying Admin Finish (Result Saving) ===");

    try {
        // 1. Setup User & Active Session
        const userExists = await query("SELECT id FROM users WHERE id = ?", [USER_ID]);
        if (userExists.length === 0) {
            await query("INSERT INTO users (id, username, email, password, role, is_blocked) VALUES (?, ?, ?, ?, ?, 0)",
                [USER_ID, 'admin-finish-user', 'adminfinish@test.com', 'dummyhash', 'student']);
        }

        // 2. Clear previous state
        await query("DELETE FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);
        await query("DELETE FROM test_sessions WHERE user_id = ? AND course_id = ?", [USER_ID, COURSE_ID]);

        // 3. Create a fake attendance and session
        await query(`
            INSERT INTO test_attendance (user_id, test_identifier, status, locked, is_used)
            VALUES (?, ?, 'approved', 0, 0)
        `, [USER_ID, COURSE_ID]);

        const attendance = await queryOne("SELECT id FROM test_attendance WHERE user_id = ? AND test_identifier = ?", [USER_ID, COURSE_ID]);

        const session = await TestSession.create({
            user_id: USER_ID,
            course_id: COURSE_ID,
            level: 1
        });
        console.log(`Created test session: ${session.id}`);

        // 4. Trigger the "Admin Finish" logic (internal call to what the endpoint does)
        console.log("[STEP] Simulating Admin Finish (submit)...");
        // We find the active session just like the route does
        const activeSession = await queryOne(
            "SELECT id FROM test_sessions WHERE user_id = ? AND course_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1",
            [USER_ID, COURSE_ID]
        );

        if (activeSession) {
            await TestSession.complete(activeSession.id);
            console.log("✅ PASS: TestSession.complete called successfully.");
        } else {
            throw new Error("Active session not found for simulation");
        }

        // 5. Verify results
        const finalized = await queryOne("SELECT * FROM test_sessions WHERE id = ?", [activeSession.id]);
        if (finalized.completed_at && finalized.overall_status) {
            console.log(`✅ PASS: Session finalized. Status: ${finalized.overall_status}, Completed At: ${finalized.completed_at}`);
        } else {
            console.log("❌ FAIL: Session not properly finalized.");
            console.log(finalized);
        }

        // 6. Verify Attendance marked used
        const attFinal = await queryOne("SELECT is_used FROM test_attendance WHERE id = ?", [attendance.id]);
        if (attFinal.is_used) {
            console.log("✅ PASS: Attendance marked as used.");
        } else {
            console.log("❌ FAIL: Attendance NOT marked as used.");
        }

        process.exit(0);

    } catch (error) {
        console.error("Test Error:", error);
        process.exit(1);
    }
}

main();
