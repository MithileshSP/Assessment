const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { verifyToken } = require('../middleware/auth');

// Submit feedback
router.post('/', verifyToken, async (req, res) => {
    const { submissionId, difficulty, clarity, comments } = req.body;
    const userId = req.user?.id;

    if (!submissionId) return res.status(400).json({ error: 'Missing submission ID' });
    if (!userId) return res.status(400).json({ error: 'User ID not found in token' });

    try {
        await query(
            `INSERT INTO student_feedback (user_id, submission_id, difficulty_rating, clarity_rating, comments)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE difficulty_rating = VALUES(difficulty_rating), clarity_rating = VALUES(clarity_rating), comments = VALUES(comments)`,
            [userId, submissionId, difficulty, clarity, comments]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Feedback submission error:', err);
        // If table doesn't exist, return 200 with a note (non-critical feature)
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return res.json({ success: true, note: 'Feedback feature not configured' });
        }
        res.status(500).json({ error: 'Failed to submit feedback', details: err.message });
    }
});

// Get feedback (for a submission) - to check if already submitted
router.get('/:submissionId', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const submissionId = req.params.submissionId;

    try {
        const rows = await query(
            "SELECT * FROM student_feedback WHERE user_id = ? AND submission_id = ?",
            [userId, submissionId]
        );
        res.json({ feedback: rows[0] || null });
    } catch (err) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

module.exports = router;
