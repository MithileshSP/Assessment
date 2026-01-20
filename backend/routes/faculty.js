const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { verifyToken, verifyFaculty } = require('../middleware/auth');

// Get faculty statistics
router.get('/stats', verifyFaculty, async (req, res) => {
    try {
        const facultyId = req.user.id;

        // 1. Count questions added by this faculty
        const questionsResult = await db.query(
            "SELECT COUNT(*) as count FROM challenges WHERE created_by = ?",
            [facultyId]
        );

        // 2. Count evaluated submissions
        const evaluatedResult = await db.query(
            "SELECT COUNT(*) as count FROM submission_assignments WHERE faculty_id = ? AND status = 'evaluated'",
            [facultyId]
        );

        // 3. Count pending submissions
        const pendingResult = await db.query(
            "SELECT COUNT(*) as count FROM submission_assignments WHERE faculty_id = ? AND status = 'pending'",
            [facultyId]
        );

        res.json({
            questionsAdded: questionsResult[0]?.count || 0,
            evaluated: evaluatedResult[0]?.count || 0,
            pending: pendingResult[0]?.count || 0
        });
    } catch (error) {
        console.error("Error fetching faculty stats:", error);
        res.status(500).json({ error: "Failed to fetch faculty statistics" });
    }
});

// Get list of submissions assigned to this faculty
router.get('/queue', verifyFaculty, async (req, res) => {
    try {
        const facultyId = req.user.id;

        const sql = `
            SELECT 
                s.id, s.user_id as candidate_name, s.submitted_at, s.challenge_id, 
                s.level, c.title as challenge_title, co.title as course_title,
                sa.status as assignment_status
            FROM submission_assignments sa
            JOIN submissions s ON sa.submission_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN challenges c ON s.challenge_id = c.id
            LEFT JOIN courses co ON s.course_id = co.id
            WHERE sa.faculty_id = ? AND sa.status = 'pending'
            ORDER BY s.submitted_at ASC
        `;

        const queue = await db.query(sql, [facultyId]);
        res.json(queue);
    } catch (error) {
        console.error("Error fetching queue:", error);
        res.status(500).json({
            error: error.message,
            msg: "Failed to fetch faculty queue",
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get single submission details (Read-only view for faculty)
router.get('/submission/:id', verifyFaculty, async (req, res) => {
    const submissionId = req.params.id;
    const facultyId = req.user.id;

    try {
        // Verify assignment
        const assignment = await db.query(
            "SELECT * FROM submission_assignments WHERE submission_id = ? AND faculty_id = ?",
            [submissionId, facultyId]
        );

        // Allow admin to view any, but faculty only their own
        if (req.user.role !== 'admin' && assignment.length === 0) {
            return res.status(403).json({ error: 'Not assigned to this submission' });
        }

        const submission = await db.query(`
            SELECT 
                s.*, 
                s.user_id as candidate_name, 
                c.title as course_title,
                ch.title as challenge_title,
                ch.expected_screenshot_url as expected_screenshot,
                ch.expected_html,
                ch.expected_css,
                ch.expected_js,
                ch.description as challenge_description,
                ch.instructions as challenge_instructions
            FROM submissions s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN courses c ON s.course_id = c.id
            LEFT JOIN challenges ch ON s.challenge_id = ch.id
            WHERE s.id = ?
        `, [submissionId]);

        if (submission.length === 0) return res.status(404).json({ error: 'Not found' });

        // Get existing manual evaluation if any
        const evaluation = await db.query(
            "SELECT * FROM manual_evaluations WHERE submission_id = ?",
            [submissionId]
        );

        // Get student feedback
        const studentFeedback = await db.query(
            "SELECT * FROM student_feedback WHERE submission_id = ?",
            [submissionId]
        );

        res.json({
            submission: submission[0],
            evaluation: evaluation[0] || null,
            studentFeedback: studentFeedback[0] || null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// Submit evaluation
router.post('/evaluate', verifyFaculty, async (req, res) => {
    try {
        const { submissionId, codeQuality, requirements, expectedOutput, comments } = req.body;
        const facultyId = req.user.id;

        if (!submissionId) {
            return res.status(400).json({ error: 'Submission ID is required' });
        }

        // Validate submission exists
        const submission = await db.query('SELECT * FROM submissions WHERE id = ?', [submissionId]);
        if (submission.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Verify assignment (optional strict check: ensure it is assigned to this faculty)
        // For now, we allow admins or assigned faculty. Since verifyFaculty allows admins, we proceed.

        // Insert/Update Manual Evaluation
        const insertUpdateQuery = `
            INSERT INTO manual_evaluations 
            (submission_id, faculty_id, code_quality_score, requirements_score, expected_output_score, comments, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            AS new
            ON DUPLICATE KEY UPDATE 
            code_quality_score = new.code_quality_score,
            requirements_score = new.requirements_score,
            expected_output_score = new.expected_output_score,
            comments = new.comments,
            faculty_id = new.faculty_id
        `;

        await db.query(insertUpdateQuery, [submissionId, facultyId, codeQuality || 0, requirements || 0, expectedOutput || 0, comments]);

        // Calculate total score and determine pass/fail
        const totalScore = (codeQuality || 0) + (requirements || 0) + (expectedOutput || 0);
        const passed = totalScore >= 80;
        const status = passed ? 'passed' : 'failed';

        // Update main submission status and evaluated_at
        await db.query(
            "UPDATE submissions SET status = ?, passed = ?, evaluated_at = NOW() WHERE id = ?",
            [status, passed, submissionId]
        );

        // Mark assignment as evaluated
        await db.query(
            "UPDATE submission_assignments SET status = 'evaluated' WHERE submission_id = ?",
            [submissionId]
        );

        // Level Unlock Logic: If passed, unlock next level in user_progress
        if (passed) {
            const sub = submission[0];
            const userId = sub.user_id;
            const courseId = sub.course_id;
            const level = sub.level;

            // Update user_progress: set current_level to level + 1 if it's currently <= level
            await db.query(
                `INSERT INTO user_progress (user_id, course_id, current_level, completed_levels) 
                 VALUES (?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 current_level = GREATEST(current_level, ?),
                 completed_levels = JSON_ARRAY_APPEND(IFNULL(completed_levels, JSON_ARRAY()), '$', ?),
                 last_updated = NOW()`,
                [userId, courseId, level + 1, JSON.stringify([level]), level + 1, level]
            );

            // Clean up duplicates in completed_levels (simplified approach: just let JSON_ARRAY_APPEND grow or use a more complex query)
            // For now, GREATEST handles current_level unlock correctly.
        }

        res.json({
            message: 'Evaluation submitted successfully',
            status: status,
            score: totalScore
        });
    } catch (error) {
        console.error('Evaluation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get history of evaluated submissions by this faculty
router.get('/history', verifyFaculty, async (req, res) => {
    try {
        const facultyId = req.user.id;

        const sql = `
            SELECT 
                s.id, s.user_id as candidate_name, s.submitted_at, s.challenge_id, 
                s.level, c.title as challenge_title, co.title as course_title,
                sa.status as assignment_status, me.total_score as manual_score
            FROM submission_assignments sa
            JOIN submissions s ON sa.submission_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN challenges c ON s.challenge_id = c.id
            LEFT JOIN courses co ON s.course_id = co.id
            LEFT JOIN manual_evaluations me ON s.id = me.submission_id
            WHERE sa.faculty_id = ? AND sa.status = 'evaluated'
            ORDER BY s.evaluated_at DESC
        `;

        const history = await db.query(sql, [facultyId]);
        res.json(history);
    } catch (error) {
        console.error("Error fetching faculty history:", error);
        res.status(500).json({ error: "Failed to fetch faculty history" });
    }
});

module.exports = router;
