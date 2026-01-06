const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'portal_mysql',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gokul',
    database: process.env.DB_NAME || 'fullstack_test_portal',
    port: process.env.DB_PORT || 3306
};

async function backfillSessions() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        // 1. Get all submissions that are NOT already linked in a test_session
        // (Since we don't have a direct link in submissions table, we check if they are in test_sessions.submission_ids)

        // First, let's just get ALL submissions
        const [submissions] = await connection.execute('SELECT * FROM submissions ORDER BY submitted_at ASC');
        console.log(`Found ${submissions.length} submissions.`);

        if (submissions.length === 0) {
            console.log('No submissions found. Nothing to backfill.');
            return;
        }

        // 2. Group submissions by User + Course + Level
        // We assume a "session" is a unique combination of User, Course, and Level.
        // Ideally, we'd use a time window, but for recovery, this is safest.
        const sessionsMap = new Map();

        for (const sub of submissions) {
            // If course_id or level are missing, try to infer or fallback
            const courseId = sub.course_id || 'course-fullstack-1'; // Fallback default
            const level = sub.level || 1; // Fallback default

            const key = `${sub.user_id}-${courseId}-${level}`;

            if (!sessionsMap.has(key)) {
                sessionsMap.set(key, {
                    user_id: sub.user_id,
                    course_id: courseId,
                    level: level,
                    submissions: [],
                    startTime: sub.submitted_at,
                    endTime: sub.submitted_at
                });
            }

            const session = sessionsMap.get(key);
            session.submissions.push(sub);

            // Update time range
            if (new Date(sub.submitted_at) < new Date(session.startTime)) session.startTime = sub.submitted_at;
            if (new Date(sub.submitted_at) > new Date(session.endTime)) session.endTime = sub.submitted_at;
        }

        console.log(`Identified ${sessionsMap.size} unique test sessions.`);

        // 3. Create or Update Test Sessions
        for (const [key, data] of sessionsMap) {
            const submissionIds = data.submissions.map(s => s.id);

            // Check if session already exists for this user/course/level
            const [existing] = await connection.execute(
                'SELECT * FROM test_sessions WHERE user_id = ? AND course_id = ? AND level = ?',
                [data.user_id, data.course_id, data.level]
            );

            if (existing.length > 0) {
                console.log(`Session exists for ${key}. Updating...`);
                // Update existing session
                const session = existing[0];
                // Merge submission IDs
                const existingIds = typeof session.submission_ids === 'string'
                    ? JSON.parse(session.submission_ids)
                    : session.submission_ids || [];

                const allIds = [...new Set([...existingIds, ...submissionIds])];

                // Recalculate stats
                const passedCount = data.submissions.filter(s => s.status === 'passed' || s.passed).length;
                const overallStatus = passedCount === data.submissions.length ? 'passed' : 'failed'; // Simplified logic

                await connection.execute(
                    `UPDATE test_sessions 
           SET submission_ids = ?, passed_count = ?, overall_status = ? 
           WHERE id = ?`,
                    [JSON.stringify(allIds), passedCount, overallStatus, session.id]
                );
            } else {
                console.log(`Creating new session for ${key}...`);
                // Create new session
                const sessionId = uuidv4();
                const passedCount = data.submissions.filter(s => s.status === 'passed' || s.passed).length;
                const overallStatus = passedCount === data.submissions.length ? 'passed' : 'failed';

                await connection.execute(
                    `INSERT INTO test_sessions 
           (id, user_id, course_id, level, submission_ids, total_questions, passed_count, overall_status, started_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        sessionId,
                        data.user_id,
                        data.course_id,
                        data.level,
                        JSON.stringify(submissionIds),
                        data.submissions.length,
                        passedCount,
                        overallStatus,
                        data.startTime,
                        data.endTime
                    ]
                );
            }
        }

        console.log('Backfill complete.');

    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

backfillSessions();
