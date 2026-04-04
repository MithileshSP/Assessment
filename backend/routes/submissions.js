/**
 * Submissions Routes
 * Handles candidate code submissions
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const SubmissionModel = require('../models/Submission');
const { query } = require('../database/connection');
const { verifyToken } = require('../middleware/auth');

const nodeID = process.env.HOSTNAME || 'local-node';
const submissionsPath = path.join(__dirname, `../data/submissions_${nodeID}.json`);

// Helper to load JSON files
const loadJSON = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return [];
  }
};

// Helper to save JSON files
const saveJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
};

// Helper to get all submissions
const getSubmissions = () => {
  return loadJSON(submissionsPath);
};

// Helper to save submissions
const saveSubmissions = (submissions) => {
  return saveJSON(submissionsPath, submissions);
};

/**
 * POST /api/submissions
 * Submit candidate solution
 * Body: { challengeId, candidateName, code: { html, css, js }, isAutoSave }
 */
router.post("/", verifyToken, async (req, res) => {
  const { challengeId, code, isAutoSave } = req.body;
  const userId = req.user.id; // AUTHORITATIVE: Use verified ID from token, not body
  const candidateNameFromBody = req.body.candidateName; // Keep for logging/fallback if DB is down
  console.log(`[SubmissionsAPI] Incoming ${isAutoSave ? 'Draft' : 'Final'} Submission:`, {
    challengeId, userId, codeKeys: Object.keys(code || {}), hasHTML: !!code?.html, sessionId: req.body.sessionId
  });

  try {
    const { sessionId } = req.body;

    // AUTHORITATIVE TIMER CHECK
    if (sessionId) {
      const { validateSessionActive } = require('../services/sessionValidator');
      const isValid = await validateSessionActive(sessionId, userId);
      if (!isValid) {
        return res.status(403).json({
          error: 'Session Expired',
          message: 'Your test session has ended or is invalid. No further submissions are allowed.'
        });
      }
    }

    // REMOVED: Multi-layered safety check that required code content.
    // INDUSTRY GRADE: We now allow "empty" submissions to ensure 100% visibility.
    // If a student views the test and finishes without writing code, we still record the attempt for the Admin's audit trail.

    // Get the course_id and level from the challenge
    let courseId, level;
    try {
      const challengeResult = await query(
        "SELECT course_id, level FROM challenges WHERE id = ?",
        [challengeId]
      );
      courseId = challengeResult[0]?.course_id;
      level = challengeResult[0]?.level;
    } catch (e) {
      console.warn('Failed to get challenge info:', e.message);
    }

    // Get user's real name if possible from DB (Authoritative)
    let studentName = candidateNameFromBody || 'Anonymous';
    if (userId) {
      try {
        const userResult = await query("SELECT full_name FROM users WHERE id = ?", [userId]);
        if (userResult[0]?.full_name) {
          studentName = userResult[0].full_name;
        }
      } catch (e) { /* ignore */ }
    }

    // AUTO-SAVE / DRAFT LOGIC: UPSERT to prevent duplicates
    if (isAutoSave) {
      try {
        // Check for existing 'saved' draft for this user + challenge
        const existingDraft = await query(
          "SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND status = 'saved' LIMIT 1",
          [userId || 'user-demo-student', challengeId]
        );

        if (existingDraft.length > 0) {
          // UPDATE existing draft
          await query(
            `UPDATE submissions SET 
              html_code = ?, css_code = ?, js_code = ?, additional_files = ?,
              submitted_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [code?.html || '', code?.css || '', code?.js || '', JSON.stringify(code?.additionalFiles || {}), existingDraft[0].id]
          );
          return res.status(200).json({
            message: 'Draft saved',
            submissionId: existingDraft[0].id,
            isDraft: true
          });
        } else {
          // INSERT new draft with status 'saved'
          const draftId = uuidv4();
          await query(
            `INSERT INTO submissions 
              (id, challenge_id, user_id, candidate_name, html_code, css_code, js_code, status, course_id, level, submitted_at, additional_files)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, CURRENT_TIMESTAMP, ?)`,
            [draftId, challengeId, userId || 'user-demo-student', studentName || 'Anonymous',
              code?.html || '', code?.css || '', code?.js || '', courseId, level, JSON.stringify(code?.additionalFiles || {})]
          );
          return res.status(201).json({
            message: 'Draft created',
            submissionId: draftId,
            isDraft: true
          });
        }
      } catch (draftError) {
        console.error('[AutoSave] Draft error:', draftError.message);
        return res.status(500).json({ error: 'Failed to save draft' });
      }
    }

    // FINAL SUBMISSION LOGIC (Write-Behind Pattern)
    const submissionId = uuidv4();
    
    // INDUSTRY GRADE: Metadata Tracking
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // INDUSTRY GRADE: Attempt Versioning
    let attemptNumber = 1;
    try {
      const [{ count }] = await query(
        "SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND challenge_id = ? AND status != 'saved'",
        [userId || 'user-demo-student', challengeId]
      );
      attemptNumber = count + 1;
    } catch (e) {
      console.warn('Failed to calculate attempt number:', e.message);
    }

    // 0. INDUSTRY GRADE: Detect active session for analytics stamping
    // This fixes the 'Session Quick Analysis' (always 0) bug.
    let activeSessionId = req.body.sessionId || null;
    try {
      const GlobalSession = require('../models/GlobalSession');
      const activeSession = await GlobalSession.findActive(courseId, level);
      if (activeSession) activeSessionId = activeSession.id;
    } catch (e) {
      console.warn('[SubmissionsAPI] Active session detection failed:', e.message);
    }

    const submissionData = {
      id: submissionId,
      challengeId,
      userId: userId || 'user-demo-student',
      candidateName: studentName || candidateNameFromBody || 'Anonymous',
      courseId,
      level,
      sessionId: activeSessionId,
      code: {
        html: code?.html || '',
        css: code?.css || '',
        js: code?.js || '',
        additionalFiles: code?.additionalFiles || {}
      },
      status: SubmissionModel.STATUS.QUEUED,
      submittedAt: new Date().toISOString(),
      attemptNumber,
      ipAddress,
      userAgent
    };

    try {
      // 1. INDUSTRY GRADE: Synchronize with test_attendance for real-time analytics
      await query(
        `UPDATE test_attendance 
         SET attempt_submitted_at = CURRENT_TIMESTAMP, 
             session_id = COALESCE(session_id, ?),
             is_used = TRUE
         WHERE user_id = ? AND test_identifier = ?
         ORDER BY requested_at DESC LIMIT 1`,
        [activeSessionId, userId || 'user-demo-student', courseId]
      );

      // 2. Push to Queue (BullMQ) for background persistence
      const { addSubmissionToDbQueue } = require('../services/submissionQueueService');
      await addSubmissionToDbQueue(submissionData);

      // 3. Respond immediately
      return res.status(202).json({
        message: 'Submission received and queued for processing',
        submissionId: submissionId,
        status: 'queued'
      });
    } catch (queueError) {
      console.error('[SubmissionsAPI] Queueing failed, falling back to JSON:', queueError.message);
      
      // FALLBACK: Safe local file storage if Redis is down
      const submissions = getSubmissions();
      submissions.push(submissionData);
      saveSubmissions(submissions);

      return res.status(202).json({
        message: 'Submission received (Fallback Storage)',
        submissionId: submissionId,
        status: 'queued'
      });
    }
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

/**
 * POST /api/submissions/batch
 * Batch auto-save for multiple submissions
 * Body: { submissions: [{ challengeId, code, userId, candidateName }], courseId, level }
 */
router.post('/batch', verifyToken, async (req, res) => {
  try {
    const { submissions, courseId, level, sessionId } = req.body;
    const userId = req.user.id; // AUTHORITATIVE

    // AUTHORITATIVE TIMER CHECK
    if (sessionId) {
      const { validateSessionActive } = require('../services/sessionValidator');
      // We assume all submissions in a batch belong to the same user
      const userId = submissions[0]?.userId;
      const isValid = await validateSessionActive(sessionId, userId);
      if (!isValid) {
        return res.status(403).json({
          error: 'Session Expired',
          message: 'Your test session has ended. Auto-save failed to persist.'
        });
      }
    }

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(200).json({ message: 'No submissions to save' });
    }

    const { transaction } = require('../database/connection');

    await transaction(async (connection) => {
      for (const sub of submissions) {
        const { challengeId, code, userId, candidateName } = sub;

        // SKIP if empty code
        if (!code || ((!code.html || !code.html.trim()) && (!code.js || !code.js.trim()))) {
          continue;
        }

        // INDUSTRY GRADE: Metadata Tracking
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // Check for existing 'saved' draft
        const [existingDrafts] = await connection.execute(
          "SELECT id, attempt_number FROM submissions WHERE user_id = ? AND challenge_id = ? AND status = 'saved' LIMIT 1",
          [userId, challengeId]
        );
        const existingDraft = existingDrafts[0];

        if (existingDraft) {
          // UPDATE existing draft
          await connection.execute(
            `UPDATE submissions SET 
              html_code = ?, css_code = ?, js_code = ?, additional_files = ?,
              submitted_at = CURRENT_TIMESTAMP,
              ip_address = ?, user_agent = ?
            WHERE id = ?`,
            [code.html || '', code.css || '', code.js || '', JSON.stringify(code.additionalFiles || {}), 
             ipAddress, userAgent, existingDraft.id]
          );
        } else {
          // INSERT new draft
          const draftId = uuidv4();
          
          // Calculate next attempt number
          const [attempts] = await connection.execute(
            "SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND challenge_id = ?",
            [userId, challengeId]
          );
          const nextAttempt = (attempts[0]?.count || 0) + 1;

          // Get candidate name if missing
          let studentName = candidateName || 'Anonymous';
          if (!candidateName && userId) {
            const [users] = await connection.execute("SELECT full_name FROM users WHERE id = ?", [userId]);
            if (users[0]?.full_name) studentName = users[0].full_name;
          }

          await connection.execute(
            `INSERT INTO submissions 
              (id, challenge_id, user_id, candidate_name, html_code, css_code, js_code, status, course_id, level, submitted_at, additional_files, attempt_number, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
            [draftId, challengeId, userId, studentName,
              code.html || '', code.css || '', code.js || '', courseId, level, JSON.stringify(code.additionalFiles || {}),
              nextAttempt, ipAddress, userAgent]
          );
        }
      }
    });

    return res.json({ message: 'Batch save successful', count: submissions.length });

  } catch (error) {
    console.error('Batch save error:', error);
    res.status(500).json({ error: 'Batch save failed' });
  }
});


/**
 * GET /api/submissions/user-level
 * Get submissions for a specific user, course, and level
 * Query params: userId, courseId, level
 */
router.get('/user-level', async (req, res) => {
  try {
    const { userId, courseId, level } = req.query;

    if (!userId || !courseId || !level) {
      return res.status(400).json({ error: 'Missing required query parameters: userId, courseId, level' });
    }

    try {
      const submissions = await query(
        `SELECT id, status, submitted_at, evaluated_at, final_score, passed
         FROM submissions 
         WHERE user_id = ? AND course_id = ? AND level = ?
         ORDER BY submitted_at DESC`,
        [userId, courseId, parseInt(level)]
      );
      return res.json(submissions);
    } catch (dbError) {
      console.error('Database error in user-level:', dbError.message);
      return res.json([]);
    }
  } catch (error) {
    console.error('Error fetching user-level submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * GET /api/submissions/:id
 * Get specific submission
 */
router.get('/:id', async (req, res) => {
  try {
    // Try database first for latest submissions with evaluation details
    try {
      const dbSubmission = await SubmissionModel.findById(req.params.id);
      if (dbSubmission) {
        return res.json(dbSubmission);
      }
    } catch (dbError) {
      console.log('Database fetch failed, using JSON fallback:', dbError.message);
    }

    // Fallback to JSON file storage
    const submissions = getSubmissions();
    const submission = submissions.find(s => s.id === req.params.id);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

/**
 * GET /api/submissions/:id/result
 * Get evaluation result for a submission
 */
router.get('/:id/result', async (req, res) => {
  try {
    // Try database first
    try {
      const dbSubmission = await SubmissionModel.findById(req.params.id);
      if (dbSubmission) {
        if (dbSubmission.status === 'pending') {
          return res.json({
            status: 'pending',
            message: 'Evaluation in progress'
          });
        }

        return res.json({
          status: dbSubmission.status,
          result: dbSubmission.result,
          evaluatedAt: dbSubmission.evaluatedAt
        });
      }
    } catch (dbError) {
      console.log('Database fetch failed for result, using JSON fallback:', dbError.message);
    }

    const submissions = getSubmissions();
    const submission = submissions.find(s => s.id === req.params.id);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.status === 'pending') {
      return res.json({
        status: 'pending',
        message: 'Evaluation in progress'
      });
    }

    res.json({
      status: submission.status,
      result: submission.result,
      evaluatedAt: submission.evaluatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

/**
 * GET /api/submissions/user/:userId
 * Get submissions for a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Try database first
    try {
      const submissions = await query(
        `SELECT s.*, 
                me.total_score as manual_score, 
                me.comments as manual_feedback,
                me.code_quality_score, 
                me.requirements_score, 
                me.expected_output_score,
                ue.username as evaluator_name
         FROM submissions s
         LEFT JOIN manual_evaluations me ON s.id = me.submission_id
         LEFT JOIN users ue ON me.faculty_id = ue.id
         WHERE s.user_id = ? 
         ORDER BY s.submitted_at DESC`,
        [userId]
      );
      const formatted = submissions.map(s => SubmissionModel._formatSubmission(s));
      return res.json(formatted);
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      const submissions = getSubmissions();
      const userSubmissions = submissions.filter(s => s.userId === userId);
      return res.json(userSubmissions);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user submissions' });
  }
});

/**
 * GET /api/submissions
 * Get all submissions (for admin)
 */
router.get('/', async (req, res) => {
  try {
    // Try database first
    try {
      const submissions = await SubmissionModel.findAll();
      return res.json(submissions);
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      // Fallback to JSON file
      const submissions = getSubmissions();
      return res.json(submissions);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * DELETE /api/submissions/:id
 * Delete a submission (for admin)
 */
router.delete('/:id', (req, res) => {
  try {
    const submissions = getSubmissions();
    const index = submissions.findIndex(s => s.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    submissions.splice(index, 1);
    saveSubmissions(submissions);

    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

/**
 * POST /api/submissions/import
 * Bulk import submissions from CSV data (parsed client-side)
 * Body: { submissions: [...] }
 * CSV Fields: Student UID, Student Name, Email, Course, Level, courseId,
 *             title, description, instructions, studentHtml, studentCss,
 *             studentJs, studentScreenshot, expectedScreenshot, Submitted At
 */
router.post('/import', async (req, res) => {
  try {
    const { submissions } = req.body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: 'Submissions array is required and must not be empty' });
    }

    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Temporarily disable FK checks so imported rows with non-existent user_id/challenge_id are accepted
    await query('SET FOREIGN_KEY_CHECKS = 0');

    for (let i = 0; i < submissions.length; i++) {
      const row = submissions[i];
      try {
        // Flexible field mapping — handle different CSV column naming conventions
        const userId = row['Student UID'] || row['student_uid'] || row['userId'] || row['user_id'] || null;
        const candidateName = row['Student Name'] || row['student_name'] || row['candidateName'] || row['candidate_name'] || 'Anonymous';
        const email = row['Email'] || row['email'] || null;
        const courseId = row['courseId'] || row['course_id'] || row['Course ID'] || null;
        const level = parseInt(row['Level'] || row['level'] || 1);
        const title = row['title'] || row['Title'] || '';
        const htmlCode = row['studentHtml'] || row['student_html'] || row['html_code'] || '';
        const cssCode = row['studentCss'] || row['student_css'] || row['css_code'] || '';
        const jsCode = row['studentJs'] || row['student_js'] || row['js_code'] || '';

        const submittedAt = row['Submitted At'] || row['submitted_at'] || row['submittedAt'] || new Date().toISOString();

        // Validate minimum required fields
        if (!userId && !email) {
          errors.push(`Row ${i + 1}: Missing Student UID and Email — at least one is required`);
          skippedCount++;
          continue;
        }

        // Resolve user_id from email if UID not provided
        let resolvedUserId = userId;
        if (!resolvedUserId && email) {
          try {
            const userResult = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
            if (userResult.length > 0) {
              resolvedUserId = userResult[0].id;
            }
          } catch (e) {
            console.warn(`[Import] Email lookup failed for ${email}:`, e.message);
          }
        }
        if (!resolvedUserId) {
          resolvedUserId = `import-${email || 'unknown-' + i}`;
        }

        // Resolve challenge_id from courseId + level + title
        let challengeId = null;
        if (courseId && title) {
          try {
            const challengeResult = await query(
              "SELECT id FROM challenges WHERE course_id = ? AND level = ? AND title = ? LIMIT 1",
              [courseId, level, title]
            );
            if (challengeResult.length > 0) {
              challengeId = challengeResult[0].id;
            }
          } catch (e) {
            console.warn(`[Import] Challenge lookup failed:`, e.message);
          }
        }
        // Fallback: try to use any challenge matching courseId + level
        if (!challengeId && courseId) {
          try {
            const fallbackResult = await query(
              "SELECT id FROM challenges WHERE course_id = ? AND level = ? LIMIT 1",
              [courseId, level]
            );
            if (fallbackResult.length > 0) {
              challengeId = fallbackResult[0].id;
            }
          } catch (e) { /* ignore */ }
        }
        if (!challengeId) {
          challengeId = `import-${courseId || 'unknown'}-L${level}-${i}`;
        }

        // Format submitted_at for MySQL
        let mysqlDate;
        try {
          const d = new Date(submittedAt);
          if (isNaN(d.getTime())) {
            mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
          } else {
            mysqlDate = d.toISOString().slice(0, 19).replace('T', ' ');
          }
        } catch {
          mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        const id = uuidv4();



        await query(
          `INSERT INTO submissions
            (id, challenge_id, user_id, course_id, level, candidate_name,
             html_code, css_code, js_code, status, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            challengeId,
            resolvedUserId,
            courseId || null,
            level,
            candidateName,
            htmlCode,
            cssCode,
            jsCode,
            'queued',
            mysqlDate
          ]
        );

        addedCount++;
      } catch (err) {
        console.error(`[Import] Row ${i + 1} error:`, err.message);
        errors.push(`Row ${i + 1}: ${err.message}`);
        skippedCount++;
      }
    }

    console.log(`[Import] Bulk import complete: ${addedCount} added, ${skippedCount} skipped out of ${submissions.length}`);

    // Re-enable FK checks
    await query('SET FOREIGN_KEY_CHECKS = 1');

    res.json({
      message: 'Import completed',
      added: addedCount,
      skipped: skippedCount,
      total: submissions.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    // Re-enable FK checks even on failure
    try { await query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) { /* ignore */ }
    console.error('[Import] Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import submissions: ' + error.message });
  }
});

module.exports = router;
