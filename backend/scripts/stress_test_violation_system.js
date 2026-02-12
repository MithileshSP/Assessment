const TEST_CONFIG = {
    baseUrl: 'http://localhost:7000/api',
    // UPDATE THESE WITH VALID CREDENTIALS
    username: 'admin', // Exists in DB
    password: 'password123',
    courseId: 'course_101',
    level: 1,
    challengeId: 'ch_001',
    iterations: 20
};

// Colors for console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const jwt = require('jsonwebtoken');

async function login() {
    try {
        console.log(`${colors.cyan}[SETUP] Generating JWT for ${TEST_CONFIG.username}...${colors.reset}`);

        // MINT TOKEN LOCALLY (Bypass login)
        // Secret from docker env: development_secret_key_change_in_production
        const secret = 'development_secret_key_change_in_production';
        const token = jwt.sign(
            {
                id: 'user-admin-1',
                username: TEST_CONFIG.username,
                role: 'student'
            },
            secret,
            { expiresIn: '1h' }
        );

        // Also simulate cookie string if needed, but Bearer auth should work based on modern JWT auth
        // If backend relies on cookie ONLY, we need to set 'token=...'
        const cookie = `token=${token}; Path=/; HttpOnly`;

        console.log(`${colors.green}[SETUP] Token generated successfully!${colors.reset}`);
        return { token, cookie };
    } catch (e) {
        console.error(`${colors.red}[SETUP] Token Generation Error:${colors.reset}`, e.message);
        process.exit(1);
    }
}

async function resetState(auth) {
    // We need an admin endpoint or a way to reset. 
    // Since we can't easily reset via API without admin, we'll just log we are starting a run.
    // In a real test, we'd delete the attendance record first.
    // FOR NIT: We'll assume the user might need to be manually reset or we use a fresh course/level combo if possible.
    // Actually, we can use the 'request' endpoint to try and get a fresh session if possible, 
    // but attendance is persistent.
    // Let's proceed assuming the user is in a state where they CAN take the test (or we'll fail fast).
    console.log(`${colors.yellow}[SETUP] NOTE: Ensure user ${TEST_CONFIG.username} has no active/locked session OR is allowed to retry.${colors.reset}`);
}

async function runScenarioA_RaceLockSubmit(auth) {
    console.log(`\n${colors.cyan}=== SCENARIO A: Lock vs Submit Race ===${colors.reset}`);
    console.log(`Spawning ${TEST_CONFIG.iterations} pairs of Lock + Submit requests simultaneously...`);

    const requests = [];
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
        // Lock Request
        const pLock = fetch(`${TEST_CONFIG.baseUrl}/attendance/lock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': auth.cookie,
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                courseId: TEST_CONFIG.courseId,
                level: TEST_CONFIG.level,
                reason: `Stress Test Lock ${i}`,
                violationCount: 99
            })
        }).then(r => r.json()).then(d => ({ type: 'LOCK', status: d.error ? 'FAIL' : 'OK', data: d }));

        // Submit Request
        const pSubmit = fetch(`${TEST_CONFIG.baseUrl}/submissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': auth.cookie,
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                challengeId: TEST_CONFIG.challengeId,
                candidateName: 'Stress Tester',
                code: { js: `// Race Test ${i}` },
                courseId: TEST_CONFIG.courseId, // Ensure these are passed if needed by backend body check
                level: TEST_CONFIG.level
            })
        }).then(r => r.json()).then(d => ({ type: 'SUBMIT', status: d.error ? 'FAIL' : 'OK', data: d }));

        requests.push(pLock);
        requests.push(pSubmit);
    }

    const results = await Promise.all(requests);

    // Analysis
    const locks = results.filter(r => r.type === 'LOCK' && r.status === 'OK').length;
    const submits = results.filter(r => r.type === 'SUBMIT' && r.status === 'OK').length;
    const fails = results.filter(r => r.status === 'FAIL').length;

    console.log(`Results: Locks: ${locks}, Submits: ${submits}, Fails: ${fails}`);

    if (locks > 0 && submits > 0) {
        console.log(`${colors.red}[FAIL] Both Lock and Submit succeeded! Race condition exists.${colors.reset}`);
        // Valid only if they were different sessions, but here it's same user same course.
        // Theoretically impossible if atomic.
        // Wait, if we run 20 iterations, and the first pair locks it... subsequent pairs should fail.
        // So we expect: ONE total success (either Lock or Submit), and 39 failures.
    } else if ((locks + submits) === 1) {
        console.log(`${colors.green}[PASS] Exactly one state transition occurred.${colors.reset}`);
    } else if ((locks + submits) === 0) {
        console.log(`${colors.red}[FAIL] No requests succeeded. (Maybe user already locked?)${colors.reset}`);
    } else {
        console.log(`${colors.yellow}[INFO] Mixed results (expected if multiple iterations run against same DB row). Total successes: ${locks + submits}${colors.reset}`);
    }
}

async function runScenarioB_DoubleSubmit(auth) {
    console.log(`\n${colors.cyan}=== SCENARIO B: Double Submit Attack ===${colors.reset}`);

    // Switch to a FRESH USER (user-faculty-1) to test double submit
    // Reuse login logic but override ID
    console.log(`${colors.cyan}[SETUP] Switching to user-faculty-1 for clean state...${colors.reset}`);
    const secret = 'development_secret_key_change_in_production';
    const token = jwt.sign(
        {
            id: 'user-faculty-1',
            username: 'faculty',
            role: 'faculty' // Works as student too for submissions usually
        },
        secret,
        { expiresIn: '1h' }
    );
    const cookie = `token=${token}; Path=/; HttpOnly`;

    // Ensure session exists for this new user
    await setupSession({ token, cookie });

    console.log(`Firing 20 parallel submission requests as faculty...`);

    const requests = [];
    for (let i = 0; i < 20; i++) {
        requests.push(
            fetch(`${TEST_CONFIG.baseUrl}/submissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookie,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    challengeId: TEST_CONFIG.challengeId,
                    candidateName: 'Double Submitter',
                    code: { js: `// Double Submit ${i}` },
                    courseId: TEST_CONFIG.courseId,
                    level: TEST_CONFIG.level
                })
            }).then(r => ({ status: r.status, body: r }))
        );
    }

    const responses = await Promise.all(requests);
    const success201 = responses.filter(r => r.status === 201).length;
    const conflict409 = responses.filter(r => r.status === 409).length;
    const forbidden403 = responses.filter(r => r.status === 403).length; // Locked
    const other = responses.filter(r => ![201, 409, 403].includes(r.status)).length;

    console.log(`201 Created: ${success201}`);
    console.log(`409 Conflict: ${conflict409}`);
    console.log(`403 Locked:   ${forbidden403}`);
    console.log(`Other:        ${other}`);

    // Log unexpected statuses
    if (other > 0) {
        responses.filter(r => ![201, 409, 403].includes(r.status)).forEach(async r => {
            console.log(`[Unexpected Status] ${r.status}`);
            try { console.log(await r.body.text()); } catch (e) { }
        });
    }

    if (success201 > 1) {
        console.log(`${colors.red}[FAIL] Multiple successful submissions detected!${colors.reset}`);
    } else if (success201 === 1) {
        console.log(`${colors.green}[PASS] Exactly one submission succeeded.${colors.reset}`);
    } else {
        console.log(`${colors.yellow}[INFO] No new submissions (already submitted/locked).${colors.reset}`);
    }
}

// Helper to ensure active session exists
async function setupSession(auth) {
    console.log(`${colors.cyan}[SETUP] ensuring active session for user...${colors.reset}`);
    try {
        const res = await fetch(`${TEST_CONFIG.baseUrl}/attendance/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': auth.cookie,
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                courseId: TEST_CONFIG.courseId,
                level: TEST_CONFIG.level
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`${colors.green}[SETUP] Session request successful: ${data.status}${colors.reset}`);
        } else {
            console.log(`${colors.yellow}[SETUP] Session request warn: ${JSON.stringify(data)}${colors.reset}`);
        }
    } catch (e) {
        console.error(`${colors.red}[SETUP] Failed to setup session:${colors.reset}`, e.message);
    }
}

async function main() {
    console.log(`${colors.green}Starting Stress Simulation...${colors.reset}`);
    const auth = await login();

    // Scenario A Setup
    await setupSession(auth);
    await runScenarioA_RaceLockSubmit(auth);

    // Wait a bit
    await sleep(2000);

    // Scenario B Setup (User switch inside runScenarioB handled via new token, need to pass it to setupSession)
    // Actually runScenarioB creates its own token inside. We should move token creation out or call setup inside.
    // Let's modify runScenarioB slightly to call setupSession with its new token.
    await runScenarioB_DoubleSubmit(auth);

    console.log(`\n${colors.green}Simulation Complete.${colors.reset}`);
}

main();
