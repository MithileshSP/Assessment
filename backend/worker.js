require('dotenv').config();
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const db = require('./database/connection');
const TestSession = require('./models/TestSession');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GPU_API_URL = process.env.GPU_API_URL;
const GPU_API_KEY = process.env.GPU_API_KEY;
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

if (!GPU_API_URL) {
    console.error("❌ GPU_API_URL is missing in environment variables. Worker cannot start.");
    process.exit(1);
}

/**
 * AI Worker Process
 * Consumes jobs from 'ai_grading_queue'
 */
const worker = new Worker('ai_grading_queue', async (job) => {
    const { submissionId, assignmentId } = job.data;
    console.log(`[AI Worker] Processing Job ID: ${job.id} for Submission: ${submissionId}`);

    // Fetch full assignment details to verify idempotency
    const assignment = await db.queryOne(
        `SELECT * FROM submission_assignments WHERE id = ?`,
        [assignmentId]
    );

    // Idempotency guard: Ensure it's still 'assigned' or 'pending'
    if (!assignment || !['pending', 'assigned'].includes(assignment.status)) {
        console.log(`[AI Worker] Skipping Job ${job.id} - Assignment status is '${assignment?.status || 'missing'}' instead of pending/assigned`);
        return { skipped: true, reason: 'idempotency_guard' };
    }

    // Update DB: AI Processing Started
    await db.query(
        `UPDATE submission_assignments 
     SET ai_processing_started_at = NOW(), status = 'in_progress' 
     WHERE id = ?`,
        [assignmentId]
    );

    try {
        // Collect all data required for the prompt
        const submission = await db.queryOne(`
      SELECT s.*, c.title as challenge_title, c.description as challenge_description, 
             c.instructions as challenge_instructions, c.expected_html, c.expected_css, c.expected_js
      FROM submissions s
      JOIN challenges c ON s.challenge_id = c.id
      WHERE s.id = ?
    `, [submissionId]);

        if (!submission) {
            throw new Error("Submission data not found");
        }

        const isHtmlCssCourse = submission.course_id === 'course-html-css' || (submission.challenge_title && submission.challenge_title.toLowerCase().includes('html'));

        const rubric = `
SCORING RUBRIC (TOTAL = 100)
1. Code Quality (0-40)
Generously reward structure, semantic HTML, and overall code cleanliness. (35-40 for genuine attempts).
2. Key Requirements (0-25)
Check if they followed basic instructions and specific challenge goals. (20-25 if they tried).
3. Output & Styling (0-35)
Evaluate if the result looks/works as intended. Be forgiving of minor visual differences. (25-35 for mostly correct output).
`;

        const hasJS = (submission.js_code || "").trim().length > 0;
        const hasUI = ((submission.html_code || "").trim().length > 0) ||
            ((submission.css_code || "").trim().length > 0);

        let focusArea = "General Web Development";
        if (hasJS && !hasUI) focusArea = "Algorithm & Logic (JavaScript)";
        else if (hasUI && !hasJS) focusArea = "UI/UX & Styling (HTML/CSS)";
        else focusArea = "Full Stack Frontend (HTML/CSS/JS)";

        const prompt = `
You are a friendly and encouraging faculty evaluator. Your goal is to provide a "faculty-like" evaluation for a beginner student: 
- **Be forgiving**: Students are beginners. Do not penalize for minor syntax errors, spelling, or small visual differences.
- **Reward effort**: If a student has made a genuine attempt with many lines of code, they should easily pass (Score 80+).
- **Correct but helpful**: Point out major logical flaws, but do it constructively. 
- **Not over-strict**: If the page "looks and works" mostly as expected, give high marks.

Focus Area: ${focusArea}
Course Context: ${isHtmlCssCourse ? "Focus primarily on the balance between HTML structure and CSS styling." : "General programming evaluation."}

**GRADING PRINCIPLES:**
1. Genuine effort/Mostly complete: Score **85-100**.
2. Partially complete/Good progress: Score **80-84**.
3. Only fail (Score < 80) if clearly blank or completely unrelated boilerplate.
4. Value understanding and effort over pixel-perfection.

---

CHALLENGE
Title: ${submission.challenge_title}
Description: ${submission.challenge_description}
Instructions: ${submission.challenge_instructions}

---

STUDENT CODE
HTML: ${submission.html_code || 'No HTML provided'}
CSS: ${submission.css_code || 'No CSS provided'}
JavaScript: ${submission.js_code || 'No JS provided'}

---

EXPECTED LOGIC
HTML: ${submission.expected_html || 'N/A'}
CSS: ${submission.expected_css || 'N/A'}
JS: ${submission.expected_js || 'N/A'}

---

${rubric}

Passing Score: **80**

---

RESPONSE FORMAT
Return ONLY a valid JSON object. You MUST include ALL fields listed below even if the value is 0 or an empty array:
{
"code_quality": number, // Max 40
"key_requirements": number, // Max 25
"output": number, // Max 35
"output_correctness": 0, // Mandatory: use 0
"best_practices": 0, // Mandatory: use 0
"final_score": number, // Sum of (code_quality + key_requirements + output)
"major_issues": ["issue1","issue2"], // Use [] if none
"feedback": "Encouraging faculty feedback (max 2 sentences). Start with something positive."
}

Rules:
* final_score = code_quality + key_requirements + output
`;

        let rawResponse;
        try {
            console.log(`[AI Worker] Sending ${submissionId} to GPU API...`);
            console.log("Sending GPU request with key:", GPU_API_KEY ? `${GPU_API_KEY.slice(0, 5)} *** ` : 'None');

            const response = await fetch(GPU_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': GPU_API_KEY || ''
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                let errorText = await response.text();
                throw new Error(`GPU API HTTP Error ${response.status}: ${errorText}`);
            }

            rawResponse = await response.json();
        } catch (fetchError) {
            console.error(`[AI Worker] ⚠️ GPU API failed for ${submissionId}: `, fetchError.message);
            console.log(`[AI Worker] 🔄 Falling back to Mock Evaluator(v3.6.0 - mock)...`);

            // Heuristic-based mock response
            const htmlLen = (htmlCode || "").length;
            const cssLen = (cssCode || "").length;
            const totalScore = Math.min(95, 40 + Math.floor((htmlLen + cssLen) / 200));

            rawResponse = {
                response: JSON.stringify({
                    code_quality: Math.min(30, 10 + Math.floor(htmlLen / 100)),
                    key_requirements: Math.min(30, 10 + Math.floor(cssLen / 100)),
                    output: Math.min(40, totalScore - 20),
                    final_score: totalScore,
                    major_issues: [],
                    feedback: "Heuristic-based AI evaluation (Mock Fallback). The submission shows basic structure and styling. Please conduct a manual faculty review for detailed feedback."
                })
            };
        }

        let aiResult;

        try {
            // Robust JSON extraction
            const text = rawResponse.response || rawResponse.text || JSON.stringify(rawResponse);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : rawResponse;
        } catch (e) {
            console.error("[AI Worker] JSON Parse Error. Raw text:", rawResponse);
            throw new Error("Failed to parse AI response as JSON");
        }

        // Verify format
        if (typeof aiResult.final_score !== 'number') {
            throw new Error(`Invalid AI response schema.Missing final_score.`);
        }

        // Wrap the result saving in a transaction to mirror manual faculty evaluation
        await db.transaction(async (conn) => {
            const passed = aiResult.final_score >= 80;

            // 1. Insert into manual_evaluations
            await conn.execute(`
            INSERT INTO manual_evaluations
    (submission_id, faculty_id, code_quality_score, requirements_score, expected_output_score, best_practices_score, final_score, major_issues, comments, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
code_quality_score = VALUES(code_quality_score), requirements_score = VALUES(requirements_score),
    expected_output_score = VALUES(expected_output_score), best_practices_score = VALUES(best_practices_score),
    final_score = VALUES(final_score), major_issues = VALUES(major_issues), comments = VALUES(comments)
        `, [
                submissionId,
                assignment.faculty_id,
                aiResult.code_quality || 0,
                aiResult.key_requirements || 0,
                aiResult.output || 0,
                0,
                aiResult.final_score,
                JSON.stringify(aiResult.major_issues || []),
                aiResult.feedback || 'Automated AI Evaluation completed.'
            ]);

            // 2. Update submissions table
            await conn.execute(`
            UPDATE submissions 
            SET status = ?, passed = ?, evaluated_at = NOW() 
            WHERE id = ?
    `, [passed ? 'passed' : 'failed', passed, submissionId]);

            // 3. Update assignment
            await conn.execute(`
            UPDATE submission_assignments 
            SET status = 'evaluated', ai_completed_at = NOW(), error_message = NULL
            WHERE id = ?
    `, [assignmentId]);

            // 4. Log the action
            await conn.execute(`
            INSERT INTO assignment_logs
    (submission_id, action_type, to_faculty_id, actor_role, notes)
VALUES(?, 'evaluate_ai', ?, 'system', 'AI evaluation completed successfully')
    `, [submissionId, assignment.faculty_id]);

            // 5. Unlock next level logic (identical to human faculty)
            if (passed) {
                const userId = submission.user_id;
                const courseId = submission.course_id;
                const level = submission.level;

                await conn.execute(`
                INSERT INTO level_completions
    (user_id, course_id, level, total_score, passed, completed_at)
VALUES(?, ?, ?, ?, TRUE, NOW())
                ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), completed_at = NOW()
    `, [userId, courseId, level, aiResult.final_score]);

                await conn.execute(`
                INSERT INTO user_progress(user_id, course_id, current_level, completed_levels)
VALUES(?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE
current_level = GREATEST(current_level, ?),
    completed_levels = CASE 
                    WHEN JSON_SEARCH(IFNULL(completed_levels, JSON_ARRAY()), 'one', ?) IS NULL 
                    THEN JSON_ARRAY_APPEND(IFNULL(completed_levels, JSON_ARRAY()), '$', ?)
                    ELSE completed_levels
END,
    last_updated = NOW()
        `, [
                    userId, courseId, level + 1, JSON.stringify([level]),
                    level + 1,
                    level.toString(), level
                ]);
            }
        });

        console.log(`[AI Worker] ✅ Grading completed for ${submissionId}`);
        return { success: true, score: aiResult.final_score };

    } catch (error) {
        console.error(`[AI Worker] ❌ Grading failed for ${submissionId}: `, error.message);

        // Save error state back to assignment so Admin can view it
        await db.query(
            `UPDATE submission_assignments 
       SET status = 'ai_error', ai_completed_at = NOW(), error_message = ?
    WHERE id = ? `,
            [error.message.substring(0, 1000), assignmentId] // safely truncate
        );

        throw error; // Let BullMQ mark the job as failed
    }

}, {
    connection,
    concurrency: 1 // Enterprise scale constraint for GPU predictability
});

// ... (existing AI worker code above)

/**
 * Submission Database Worker
 * Handles persistent storage, faculty assignment, and session linking
 */
const { v4: uuidv4 } = require('uuid');
const SubmissionModel = require('./models/Submission');

const submissionWorker = new Worker('submission_db_queue', async (job) => {
    const data = job.data;
    // Extract new industry-grade metadata
    const { 
        id, challengeId, userId, candidateName, courseId, level, code, status, submittedAt,
        attemptNumber, ipAddress, userAgent, sessionId 
    } = data;

    console.log(`[DB Worker] Persistence: User = ${userId}, Challenge = ${challengeId}, Attempt = ${attemptNumber}`);

    try {
        await db.transaction(async (connection) => {
            // SET TIMEOUT FOR THIS TRANSACTION (5s)
            await connection.execute('SET innodb_lock_wait_timeout = 5');

            // 1. Double-check for existing draft status to sync correctly
            const [existing] = await connection.execute(
                "SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND status = 'saved' LIMIT 1",
                [userId, challengeId]
            );

            let finalSubmissionId = id;
            const mysqlSubmittedAt = submittedAt ? submittedAt.replace('T', ' ').replace(/\..*$/, '').replace('Z', '') : new Date().toISOString().replace('T', ' ').replace(/\..*$/, '').replace('Z', '');

                if (existing.length > 0) {
                    // Handle late-arriving final submission (update existing draft)
                    await connection.execute(
                        `UPDATE submissions SET
                          html_code = ?, css_code = ?, js_code = ?, additional_files = ?,
                          status = ?, submitted_at = ?, ip_address = ?, user_agent = ?, session_id = ?, attempt_number = ?
                         WHERE id = ?`,
                        [code?.html || '', code?.css || '', code?.js || '', JSON.stringify(code?.additionalFiles || {}), 
                         status || 'received', mysqlSubmittedAt, ipAddress || null, userAgent || null, sessionId || null, attemptNumber || 1, existing[0].id]
                    );
                    finalSubmissionId = existing[0].id;
                } else {
                    // New submission
                    await connection.execute(
                        `INSERT INTO submissions
                          (id, challenge_id, user_id, candidate_name, html_code, css_code, js_code, status, course_id, level, session_id, submitted_at, additional_files, attempt_number, ip_address, user_agent)
                         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [id || null, challengeId || null, userId || null, candidateName || 'Anonymous', 
                         code?.html || '', code?.css || '', code?.js || '', status || 'received', 
                         courseId || null, level || null, sessionId || null, mysqlSubmittedAt, JSON.stringify(code?.additionalFiles || {}),
                         attemptNumber || 1, ipAddress || null, userAgent || null]
                    );
                }

            // 1.5 INDUSTRY GRADE: Automated Session Linking
            // This fixes the risk of "orphaned" submissions if the frontend linking call fails.
            if (sessionId && finalSubmissionId) {
                try {
                    console.log(`[DB Worker] 🔗 Linking submission ${finalSubmissionId} to session ${sessionId}`);
                    await TestSession.addSubmission(sessionId, finalSubmissionId, challengeId);
                } catch (linkError) {
                    console.warn(`[DB Worker] ⚠️ Failed to link submission ${finalSubmissionId} to session ${sessionId}:`, linkError.message);
                    // We don't throw here to avoid failing the whole persistence job, 
                    // as the code is already safely in the submissions table.
                }
            }

            // 2. Auto-assign Faculty
            if (courseId) {
                const [faculty] = await connection.execute(
                    `SELECT u.id FROM users u
                     INNER JOIN faculty_course_assignments fca ON u.id = fca.faculty_id
                     WHERE fca.course_id = ? AND u.role = 'faculty' AND u.is_available = TRUE
                     ORDER BY(SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') ASC LIMIT 1`,
                    [courseId]
                );

                if (faculty.length > 0) {
                    await connection.execute(
                        `INSERT INTO submission_assignments(submission_id, faculty_id, assigned_at, status)
VALUES(?, ?, NOW(), 'pending')
                         ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
                        [finalSubmissionId, faculty[0].id]
                    );
                }
            }
        });
        console.log(`[DB Worker] ✅ Successfully persisted submission ${id} `);
    } catch (error) {
        // IDEMPOTENCY: Ignore actual primary key (UUID) collision errors
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            console.warn(`[DB Worker] ID Conflict detected for submission ${id}. This likely means it was already processed.`);
            return { success: true, reason: 'duplicate_idempotent' };
        }
        throw error; // Let BullMQ retry other errors (lock timeouts, etc)
    }

    return { success: true, submissionId: id };

}, {
    connection,
    concurrency: 10 // Ryzen 7 can easily handle 10 concurrent I/O-bound DB writes
});

// GRACEFUL SHUTDOWN
const gracefulShutdown = async (signal) => {
    console.log(`\n[Worker] Received ${signal}. Shutting down gracefully...`);
    await worker.close();
    await submissionWorker.close();
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Automated Reconciliation Loop (Self-Healing)
 * Runs every 5 minutes to find "stuck" submissions and re-process them.
 */
const startReconciliationLoop = () => {
    setInterval(async () => {
        console.log(`[Reconciliation] 🔍 Scanning for stuck submissions...`);
        try {
            // 1. Find 'received' submissions older than 2 minutes that ARE NOT DELETED
            const stuckSubmissions = await db.query(`
                SELECT s.id, s.course_id, s.challenge_id, s.user_id 
                FROM submissions s
                LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
                WHERE s.status = 'received' 
                AND s.is_deleted = 0
                AND s.submitted_at < (NOW() - INTERVAL 2 MINUTE)
                AND sa.id IS NULL
                LIMIT 50
            `);

            if (stuckSubmissions.length > 0) {
                console.log(`[Reconciliation] 🛠️ Found ${stuckSubmissions.length} unassigned submissions. Re-triggering assignment...`);
                
                for (const sub of stuckSubmissions) {
                    // We attempt to re-assign by fetching the same logic as the worker
                    const [faculty] = await db.query(
                        `SELECT u.id FROM users u
                         INNER JOIN faculty_course_assignments fca ON u.id = fca.faculty_id
                         WHERE fca.course_id = ? AND u.role = 'faculty' AND u.is_available = TRUE
                         ORDER BY (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') ASC LIMIT 1`,
                        [sub.course_id]
                    );

                    if (faculty && faculty.length > 0) {
                        await db.query(
                            `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status)
                             VALUES (?, ?, NOW(), 'pending')
                             ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
                            [sub.id, faculty[0].id]
                        );
                        console.log(`[Reconciliation] ✅ Auto-assigned submission ${sub.id} to faculty ${faculty[0].id}`);
                    }
                }
            }

            // 2. Find AI jobs stuck in 'in_progress' for more than 10 minutes
            const stuckAiJobs = await db.query(`
                SELECT sa.id, sa.submission_id, sa.faculty_id
                FROM submission_assignments sa
                JOIN users u ON sa.faculty_id = u.id
                WHERE sa.status = 'in_progress'
                AND sa.ai_processing_started_at < (NOW() - INTERVAL 10 MINUTE)
                AND (u.username = 'ai_evaluator' OR u.username = ?)
                LIMIT 10
            `, [process.env.AI_FACULTY_USERNAME || 'ai_evaluator']);

            if (stuckAiJobs.length > 0) {
                console.log(`[Reconciliation] ⚠️ Found ${stuckAiJobs.length} stuck AI jobs. Resetting to pending...`);
                for (const job of stuckAiJobs) {
                    await db.query(
                        `UPDATE submission_assignments 
                         SET status = 'pending', ai_processing_started_at = NULL, error_message = 'Timeout - Reset by Reconciliation'
                         WHERE id = ?`,
                        [job.id]
                    );
                    // The AI worker will eventually pick it up again if it's in the queue or if we re-queue it.
                }
            }

        } catch (error) {
            console.error(`[Reconciliation] ❌ Error during scan:`, error.message);
        }
    }, 300000); // 5 minutes
};

// Start the loop
startReconciliationLoop();

console.log("🚀 AI & DB Workers started. Listening for jobs...");
