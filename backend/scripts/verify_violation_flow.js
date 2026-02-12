const BASE_URL = 'http://127.0.0.1:5001/api';
let studentToken;
let adminToken;
let courseId = 'course_1'; // Ensure this exists or use a valid one
let level = 1;
let userId;
let attendanceId;
let sessionId;

async function request(url, method, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
}

async function login(role) {
    try {
        const email = role === 'admin' ? 'admin@example.com' : 'student1@example.com';
        const password = role === 'admin' ? 'admin123' : '123456';
        const data = await request(`${BASE_URL}/auth/login`, 'POST', { email, password });
        return { token: data.token, id: data.user.id };
    } catch (e) {
        console.error(`Login failed for ${role}:`, e.message);
        process.exit(1);
    }
}

async function runTest() {
    console.log("=== STARTING VIOLATION FLOW TEST ===");

    // 1. Login
    const admin = await login('admin');
    adminToken = admin.token;
    const student = await login('student');
    studentToken = student.token;
    userId = student.id;
    console.log("Logged in.");

    // 2. Request Attendance (Start Session)
    console.log("\n--- Step 2: Request Attendance ---");
    try {
        await request(`${BASE_URL}/attendance/request`, 'POST', { courseId, level }, studentToken);

        // Admin Approve
        const reqs = await request(`${BASE_URL}/attendance/requests`, 'GET', null, adminToken);
        const myReq = reqs.find(r => r.user_id === userId);
        if (myReq) {
            await request(`${BASE_URL}/attendance/approve`, 'POST', { requestId: myReq.id, action: 'approve' }, adminToken);
            attendanceId = myReq.id;
        }

        // Get Status
        const statusRes = await request(`${BASE_URL}/attendance/status?courseId=${courseId}&level=${level}`, 'GET', null, studentToken);
        console.log("Attendance Status:", statusRes.status);

        // Create Session
        const sessionRes = await request(`${BASE_URL}/test-sessions`, 'POST', { user_id: userId, course_id: courseId, level }, studentToken);
        sessionId = sessionRes.id;
        console.log("Session Created:", sessionId);

    } catch (e) {
        console.error("Setup failed:", e.message);
    }

    // 3. Trigger Lock
    console.log("\n--- Step 3: Trigger Lock ---");
    try {
        await request(`${BASE_URL}/attendance/lock`, 'POST', {
            courseId, level, reason: 'Test Violation', violationCount: 10
        }, studentToken);

        const statusRes = await request(`${BASE_URL}/attendance/status?courseId=${courseId}&level=${level}`, 'GET', null, studentToken);
        console.log("Locked Status:", statusRes.locked);

        const violations = await request(`${BASE_URL}/attendance/violations`, 'GET', null, adminToken);
        const myViolation = violations.find(v => v.user_id === userId);
        if (myViolation) attendanceId = myViolation.id;
    } catch (e) {
        console.error("Lock failed:", e.message);
    }

    // 4. Admin Unlock (Continue)
    console.log("\n--- Step 4: Admin Unlock (Continue) ---");
    try {
        await request(`${BASE_URL}/attendance/unlock`, 'POST', { attendanceId, action: 'continue' }, adminToken);
        const statusRes = await request(`${BASE_URL}/attendance/status?courseId=${courseId}&level=${level}`, 'GET', null, studentToken);
        console.log("Unlocked Status:", statusRes.locked);
        console.log("Unlock Action:", statusRes.unlockAction);
    } catch (e) {
        console.error("Unlock Continue failed:", e.message);
    }

    // 5. Trigger Lock Again
    console.log("\n--- Step 5: Trigger Lock Again ---");
    await request(`${BASE_URL}/attendance/lock`, 'POST', { courseId, level, reason: 'Test Violation 2', violationCount: 15 }, studentToken);

    // 6. Admin Unlock (Submit)
    console.log("\n--- Step 6: Admin Unlock (Submit) ---");
    try {
        const violations = await request(`${BASE_URL}/attendance/violations`, 'GET', null, adminToken);
        const myViolation = violations.find(v => v.user_id === userId);
        attendanceId = myViolation.id;

        await request(`${BASE_URL}/attendance/unlock`, 'POST', { attendanceId, action: 'submit' }, adminToken);

        const statusRes = await request(`${BASE_URL}/attendance/status?courseId=${courseId}&level=${level}`, 'GET', null, studentToken);
        console.log("Finish Status (isUsed):", statusRes.isUsed);
        console.log("Finish Action:", statusRes.unlockAction);
    } catch (e) {
        console.error("Unlock Submit failed:", e.message);
    }

    // 7. Submit Feedback
    console.log("\n--- Step 7: Submit Feedback ---");
    try {
        await request(`${BASE_URL}/feedback`, 'POST', {
            submissionId: sessionId,
            difficulty: 4,
            clarity: 5,
            comments: "Good test with fetch"
        }, studentToken);

        const feedbackRes = await request(`${BASE_URL}/feedback/${sessionId}`, 'GET', null, studentToken);
        console.log("Feedback Retrieved:", feedbackRes.feedback);
    } catch (e) {
        console.error("Feedback failed:", e.message);
    }

    console.log("\n=== TEST COMPLETED ===");
}

runTest();
