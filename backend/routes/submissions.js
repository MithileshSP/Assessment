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

const submissionsPath = path.join(__dirname, '../data/submissions.json');

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
router.post("/", async (req, res) => {
  const { challengeId, candidateName, code, userId, isAutoSave } = req.body;
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

    // For auto-save, allow empty code (just save current state)
    if (!isAutoSave && (!code || ((!code.html || code.html.trim() === '') && (!code.js || code.js.trim() === '')))) {
      return res.status(400).json({
        error: 'Incomplete content',
        message: 'Your solution must contain at least some code (HTML or JavaScript) before you can submit.'
      });
    }

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

    // Get user's real name if possible
    let studentName = candidateName;
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

    // FINAL SUBMISSION LOGIC
    const submissionData = {
      id: uuidv4(),
      challengeId,
      userId: userId || 'user-demo-student',
      candidateName: studentName || 'Anonymous',
      code: {
        html: code?.html || '',
        css: code?.css || '',
        js: code?.js || '',
        additionalFiles: code?.additionalFiles || {}
      },
      status: SubmissionModel.STATUS.QUEUED,
      submittedAt: new Date().toISOString()
    };

    try {
      // Check if there's an existing draft to upgrade to 'pending'
      const existingDraft = await query(
        "SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND status = 'saved' LIMIT 1",
        [submissionData.userId, challengeId]
      );

      let submissionId;
      if (existingDraft.length > 0) {
        // Upgrade draft to pending
        await query(
          `UPDATE submissions SET 
            html_code = ?, css_code = ?, js_code = ?, additional_files = ?,
            status = ?, submitted_at = CURRENT_TIMESTAMP 
          WHERE id = ?`,
          [submissionData.code.html, submissionData.code.css, submissionData.code.js, JSON.stringify(submissionData.code.additionalFiles), SubmissionModel.STATUS.QUEUED, existingDraft[0].id]
        );
        submissionId = existingDraft[0].id;
      } else {
        // Create new submission
        const dbSubmission = await SubmissionModel.create({
          ...submissionData,
          courseId,
          level,
          status: SubmissionModel.STATUS.QUEUED,
          candidateName: studentName || candidateName
        });
        console.log(`[SubmissionsAPI] Successfully created DB record: ${dbSubmission.id}`);
        submissionId = dbSubmission.id;
      }

      // Auto-assign to faculty for evaluation (v3.5.0: least-loaded + capacity-aware)
      try {
        if (courseId) {
          // Try course-specific faculty first, then any available faculty
          let faculty = await query(
            `SELECT u.id, u.max_capacity,
              (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') as current_load
             FROM users u
             INNER JOIN faculty_course_assignments fca ON u.id = fca.faculty_id
             WHERE fca.course_id = ? AND u.role = 'faculty' AND u.is_available = TRUE
             HAVING current_load < u.max_capacity
             ORDER BY current_load ASC LIMIT 1`,
            [courseId]
          );

          if (faculty.length === 0) {
            faculty = await query(
              `SELECT u.id, u.max_capacity,
                (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') as current_load
               FROM users u
               WHERE u.role = 'faculty' AND u.is_available = TRUE
               HAVING current_load < u.max_capacity
               ORDER BY current_load ASC LIMIT 1`
            );
          }

          if (faculty.length > 0) {
            await query(
              `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status) 
               VALUES (?, ?, NOW(), 'pending')
               ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
              [submissionId, faculty[0].id]
            );
            // Audit log
            try {
              await query(
                `INSERT INTO assignment_logs (submission_id, action_type, to_faculty_id, notes) VALUES (?, 'auto_assign', ?, 'On-submit auto-assign')`,
                [submissionId, faculty[0].id]
              );
            } catch (logErr) { console.warn('[Submissions] Audit log failed:', logErr.message); }
          }
        }
      } catch (assignError) {
        console.error('[Submissions] Faculty assignment error:', assignError.message);
      }

      // CRITICAL: Link to active test session if exists (prevents orphan submissions)
      try {
        const activeSession = await queryOne(
          `SELECT id FROM test_sessions WHERE user_id = ? AND course_id = ? AND level = ? AND completed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
          [userId, courseId, level]
        );

        if (activeSession) {
          const TestSession = require('../models/TestSession');
          await TestSession.addSubmission(activeSession.id, submissionId);
          console.log(`[Submissions] Linked submission ${submissionId} to session ${activeSession.id}`);
        } else {
          // Fallback: Check for ANY recent session (even completed) if within last 5 minutes
          const recentSession = await queryOne(
            `SELECT id FROM test_sessions WHERE user_id = ? AND course_id = ? AND level = ? AND completed_at > (NOW() - INTERVAL 5 MINUTE) ORDER BY completed_at DESC LIMIT 1`,
            [userId, courseId, level]
          );
          if (recentSession) {
            const TestSession = require('../models/TestSession');
            await TestSession.addSubmission(recentSession.id, submissionId);
            console.log(`[Submissions] Late-linked submission ${submissionId} to completed session ${recentSession.id}`);
          }
        }
      } catch (linkError) {
        console.error('[Submissions] Failed to link to session:', linkError.message);
      }

      return res.status(201).json({
        message: 'Submission received',
        submissionId: submissionId
      });
    } catch (dbError) {
      console.log('Database save failed, using JSON fallback:', dbError.message);
      const submissions = getSubmissions();
      const submission = {
        ...submissionData,
        evaluatedAt: null,
        result: null
      };
      submissions.push(submission);
      saveSubmissions(submissions);

      return res.status(201).json({
        message: 'Submission received',
        submissionId: submission.id,
        submission
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
router.post('/batch', async (req, res) => {
  try {
    const { submissions, courseId, level, sessionId } = req.body;

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

        // Check for existing 'saved' draft
        const [existingDraft] = await connection.execute(
          "SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND status = 'saved' LIMIT 1",
          [userId || 'user-demo-student', challengeId]
        );

        if (existingDraft.length > 0) {
          // UPDATE existing draft
          await connection.execute(
            `UPDATE submissions SET 
              html_code = ?, css_code = ?, js_code = ?, additional_files = ?,
              submitted_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [code.html || '', code.css || '', code.js || '', JSON.stringify(code.additionalFiles || {}), existingDraft[0].id]
          );
        } else {
          // INSERT new draft
          const draftId = uuidv4();
          // Get candidate name if missing
          let studentName = candidateName || 'Anonymous';
          if (!candidateName && userId) {
            const [users] = await connection.execute("SELECT full_name FROM users WHERE id = ?", [userId]);
            if (users[0]?.full_name) studentName = users[0].full_name;
          }

          await connection.execute(
            `INSERT INTO submissions 
              (id, challenge_id, user_id, candidate_name, html_code, css_code, js_code, status, course_id, level, submitted_at, additional_files)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, CURRENT_TIMESTAMP, ?)`,
            [draftId, challengeId, userId || 'user-demo-student', studentName,
              code.html || '', code.css || '', code.js || '', courseId, level, JSON.stringify(code.additionalFiles || {})]
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

module.exports = router;
