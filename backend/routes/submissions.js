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
 * Body: { challengeId, candidateName, code: { html, css, js } }
 */
router.post('/', async (req, res) => {
  try {
    const { challengeId, candidateName, code, userId } = req.body;

    if (!challengeId || !code || !code.html || code.html.trim() === '') {
      return res.status(400).json({
        error: 'Incomplete content',
        message: 'Your solution must contain at least some HTML structure before you can submit.'
      });
    }

    const submissionData = {
      id: uuidv4(),
      challengeId,
      userId: userId || 'user-demo-student', // Use demo student as default
      candidateName: candidateName || 'Anonymous',
      code: {
        html: code.html,
        css: code.css || '',
        js: code.js || ''
      },
      status: SubmissionModel.STATUS.QUEUED,
      submittedAt: new Date().toISOString()
    };

    // Try to save to database first
    try {
      // Get the course_id and level from the challenge
      const challengeResult = await query(
        "SELECT course_id, level FROM challenges WHERE id = ?",
        [challengeId]
      );
      const courseId = challengeResult[0]?.course_id;
      const level = challengeResult[0]?.level;

      // Get user's real name if possible
      let studentName = candidateName;
      if (userId) {
        const userResult = await query("SELECT full_name FROM users WHERE id = ?", [userId]);
        if (userResult[0]?.full_name) {
          studentName = userResult[0].full_name;
        }
      }

      const dbSubmission = await SubmissionModel.create({
        ...submissionData,
        courseId,
        level,
        candidateName: studentName || candidateName
      });

      // Auto-assign to faculty for evaluation
      try {
        if (courseId) {
          // Find a faculty assigned to this course, or any faculty
          let faculty = await query(
            `SELECT u.id FROM users u 
             INNER JOIN faculty_course_assignments fca ON u.id = fca.faculty_id 
             WHERE fca.course_id = ? AND u.role = 'faculty' 
             ORDER BY RAND() LIMIT 1`,
            [courseId]
          );

          // If no faculty assigned to course, get any faculty
          if (faculty.length === 0) {
            faculty = await query(
              "SELECT id FROM users WHERE role = 'faculty' ORDER BY RAND() LIMIT 1"
            );
          }

          if (faculty.length > 0) {
            await query(
              `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status) 
               VALUES (?, ?, NOW(), 'pending')
               ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
              [dbSubmission.id, faculty[0].id]
            );
            console.log(`[Submissions] Auto-assigned submission ${dbSubmission.id} to faculty ${faculty[0].id}`);
          } else {
            console.log(`[Submissions] No faculty available to assign submission ${dbSubmission.id}`);
          }
        }
      } catch (assignError) {
        // Don't fail the submission if assignment fails
        console.error('[Submissions] Faculty assignment error:', assignError.message);
      }

      return res.status(201).json({
        message: 'Submission received',
        submissionId: dbSubmission.id,
        submission: dbSubmission
      });
    } catch (dbError) {
      console.log('Database save failed, using JSON fallback:', dbError.message);
      // Fallback to JSON file
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
      // Parse JSON evaluation_result if it's a string
      const parsed = submissions.map(s => ({
        ...s,
        result: typeof s.evaluation_result === 'string' ? JSON.parse(s.evaluation_result) : s.evaluation_result
      }));
      return res.json(parsed);
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
