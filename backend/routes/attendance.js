const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// Request attendance
router.post('/request', verifyToken, async (req, res) => {
    const { courseId, level } = req.body;
    const userId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    if (!courseId || !level) {
        return res.status(400).json({ error: 'Missing courseId or level' });
    }

    try {
        // Check if already requested
        const existing = await query(
            "SELECT * FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
            [userId, testIdentifier]
        );

        if (existing.length > 0) {
            // Return existing status
            return res.json({ success: true, status: existing[0].status });
        }

        await query(
            "INSERT INTO test_attendance (user_id, test_identifier, status) VALUES (?, ?, 'requested')",
            [userId, testIdentifier]
        );

        res.json({ success: true, status: 'requested' });
    } catch (error) {
        console.error('Attendance request error:', error);
        res.status(500).json({ error: 'Failed to request attendance' });
    }
});

// Check status
router.get('/status', verifyToken, async (req, res) => {
    const { courseId, level } = req.query;
    const userId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    if (!courseId || !level) return res.status(400).json({ error: 'Missing params' });

    try {
        const result = await query(
            "SELECT status, approved_at FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
            [userId, testIdentifier]
        );
        if (result.length > 0) {
            res.json({ status: result[0].status, approvedAt: result[0].approved_at });
        } else {
            res.json({ status: 'none' }); // Not requested yet
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Check failed' });
    }
});

// Admin: Get pending requests
router.get('/requests', verifyAdmin, async (req, res) => {
    try {
        // Get all requested, join with user details
        const rows = await query(`
            SELECT ta.id, ta.user_id, u.username, u.full_name, ta.test_identifier, ta.requested_at, ta.status 
            FROM test_attendance ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.status = 'requested'
            ORDER BY ta.requested_at ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Admin: Approve/Reject
router.post('/approve', verifyAdmin, async (req, res) => {
    const { requestId, action } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user.id;

    if (!requestId || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const approvedAt = action === 'approve' ? new Date() : null;

    try {
        await query(
            "UPDATE test_attendance SET status = ?, approved_at = ?, approved_by = ? WHERE id = ?",
            [newStatus, approvedAt, adminId, requestId]
        );
        res.json({ success: true, status: newStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Admin: Proactive Manual Approval
router.post('/manual-approve', verifyAdmin, async (req, res) => {
    const { userId, courseId, level } = req.body;
    const adminId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    console.log('[Manual Approve] Request:', { userId, courseId, level, adminId, testIdentifier });

    if (!userId || !courseId || !level) {
        console.log('[Manual Approve] Missing required fields:', { userId, courseId, level });
        return res.status(400).json({ error: 'Missing required fields: userId, courseId, and level are required' });
    }

    try {
        // Verify the user exists first
        const userCheck = await query("SELECT id, username FROM users WHERE id = ?", [userId]);
        if (userCheck.length === 0) {
            console.log('[Manual Approve] User not found:', userId);
            return res.status(404).json({ error: `User not found with ID: ${userId}` });
        }
        console.log('[Manual Approve] User verified:', userCheck[0].username);

        // Verify the course exists
        const courseCheck = await query("SELECT id, title FROM courses WHERE id = ?", [courseId]);
        if (courseCheck.length === 0) {
            console.log('[Manual Approve] Course not found:', courseId);
            return res.status(404).json({ error: `Course not found with ID: ${courseId}` });
        }
        console.log('[Manual Approve] Course verified:', courseCheck[0].title);

        // Upsert logic: if exists update, else insert
        const existing = await query(
            "SELECT id FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
            [userId, testIdentifier]
        );

        if (existing.length > 0) {
            console.log('[Manual Approve] Updating existing record:', existing[0].id);
            await query(
                "UPDATE test_attendance SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?",
                [adminId, existing[0].id]
            );
        } else {
            console.log('[Manual Approve] Creating new attendance record');
            await query(
                "INSERT INTO test_attendance (user_id, test_identifier, status, approved_at, approved_by) VALUES (?, ?, 'approved', CURRENT_TIMESTAMP, ?)",
                [userId, testIdentifier, adminId]
            );
        }

        console.log('[Manual Approve] Success for user:', userCheck[0].username);
        res.json({ success: true, message: `User ${userCheck[0].username} approved for ${courseCheck[0].title} Level ${level}` });
    } catch (error) {
        console.error('[Manual Approve] Error:', error);
        res.status(500).json({ error: 'Failed to approve attendance: ' + error.message });
    }
});

// Admin: Bulk Proactive Approval (CSV)
router.post('/bulk-approve', verifyAdmin, async (req, res) => {
    const { usernames, courseId, level } = req.body; // usernames is an array
    const adminId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    if (!usernames || !Array.isArray(usernames) || !courseId || !level) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        // 1. Get user IDs for these usernames
        const users = await query(
            "SELECT id, username FROM users WHERE username IN (?)",
            [usernames]
        );

        const results = {
            approved: 0,
            notFound: usernames.filter(un => !users.find(u => u.username === un))
        };

        // 2. Process each user
        for (const user of users) {
            const existing = await query(
                "SELECT id FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
                [user.id, testIdentifier]
            );

            if (existing.length > 0) {
                await query(
                    "UPDATE test_attendance SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?",
                    [adminId, existing[0].id]
                );
            } else {
                await query(
                    "INSERT INTO test_attendance (user_id, test_identifier, status, approved_at, approved_by) VALUES (?, ?, 'approved', CURRENT_TIMESTAMP, ?)",
                    [user.id, testIdentifier, adminId]
                );
            }
            results.approved++;
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Bulk approval error:', error);
        res.status(500).json({ error: 'Failed to process bulk approval' });
    }
});

module.exports = router;
