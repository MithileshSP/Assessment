const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query, queryOne } = require('../database/connection');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const GlobalSession = require('../models/GlobalSession');

// Configure multer for reference images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/reference_images');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ref-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Request attendance
router.post('/request', verifyToken, async (req, res) => {
    const { courseId, level } = req.body;
    const userId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    if (!courseId || !level) {
        return res.status(400).json({ error: 'Missing courseId or level' });
    }

    console.log(`[Attendance Request] User: ${userId}, Identifier: ${testIdentifier}`);

    try {
        // 0. Verify user exists to prevent FK violation
        const userExists = await queryOne("SELECT id FROM users WHERE id = ?", [userId]);
        if (!userExists) {
            console.error(`[Attendance Request] CRITICAL: User ${userId} not found in database!`);
            return res.status(500).json({ error: `User profile [${userId}] not found. Please re-login.` });
        }

        // 1. Check for active global session
        const activeSession = await GlobalSession.findActive(courseId, level);
        const sessionId = activeSession ? activeSession.id : null;

        // 2. Check if already requested/approved for THIS session (or latest request if no session)
        const checkSql = sessionId
            ? "SELECT * FROM test_attendance WHERE user_id = ? AND session_id = ?"
            : "SELECT * FROM test_attendance WHERE user_id = ? AND test_identifier = ? AND session_id IS NULL";

        const checkParams = sessionId ? [userId, sessionId] : [userId, testIdentifier];

        const existing = await query(checkSql, checkParams);

        if (existing.length > 0) {
            if (existing[0].is_used) {
                // Allow re-requesting if already used
                await query(
                    "UPDATE test_attendance SET status = 'requested', is_used = FALSE, requested_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [existing[0].id]
                );
                return res.json({ success: true, status: 'requested' });
            }
            return res.json({ success: true, status: existing[0].status });
        }

        // 3. Create new request linked to session (or lack thereof)
        await query(
            "INSERT INTO test_attendance (user_id, test_identifier, status, session_id) VALUES (?, ?, 'requested', ?)",
            [userId, testIdentifier, sessionId]
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
        // 1. Check for active global session
        const activeSession = await GlobalSession.findActive(courseId, level);

        // 2. Get user details
        const user = await queryOne("SELECT is_blocked, roll_no, email, full_name FROM users WHERE id = ?", [userId]);
        const isUserBlocked = user ? Boolean(user.is_blocked) : true;

        // 3. Get course title
        const course = await queryOne("SELECT title FROM courses WHERE id = ?", [courseId]);
        const courseTitle = course ? course.title : 'Unknown Course';

        // 4. Get individual attendance record including lock fields
        const result = await query(
            `SELECT status, approved_at, is_used, session_id, locked, locked_reason, violation_count, reference_image 
             FROM test_attendance WHERE user_id = ? AND test_identifier = ? ORDER BY requested_at DESC LIMIT 1`,
            [userId, testIdentifier]
        );

        let response = {
            status: 'none',
            approvedAt: null,
            isUsed: false,
            isBlocked: isUserBlocked,
            locked: false,
            lockedReason: null,
            unlockAction: null,
            session: activeSession,
            studentDetails: {
                fullName: user?.full_name || 'Student',
                rollNo: user?.roll_no || 'N/A',
                email: user?.email || 'N/A',
                courseTitle
            }
        };

        if (result.length > 0) {
            response.status = result[0].status;
            response.approvedAt = result[0].approved_at;
            response.isUsed = Boolean(result[0].is_used);
            response.locked = Boolean(result[0].locked);
            response.lockedReason = result[0].locked_reason;

            // Determine unlock action based on state changes
            if (!result[0].locked && result[0].locked_reason) {
                if (result[0].locked_reason === 'Admin:submit') {
                    response.unlockAction = 'submit';
                } else if (result[0].locked_reason === 'Admin:continue') {
                    response.unlockAction = 'continue';
                }
            }
        }

        // GLOBAL UNBLOCK BYPASS: If student is unblocked globally, they are 'approved'
        // This allows students from different courses to attend simultaneously.
        if (!isUserBlocked) {
            // Only override if not already 'used' or 'locked'
            if (response.status !== 'used' && !response.locked) {
                response.status = 'approved';
            }
        }

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Check failed' });
    }
});

// Admin: Get pending requests (with student details)
router.get('/requests', verifyAdmin, async (req, res) => {
    try {
        // Get all requested, join with user details including email
        const rows = await query(`
            SELECT ta.id, ta.user_id, u.username, u.full_name, u.email, 
                   ta.test_identifier, ta.requested_at, ta.status,
                   ta.locked, ta.locked_reason, ta.violation_count
            FROM test_attendance ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.status = 'requested' OR ta.locked = 1
            ORDER BY ta.locked DESC, ta.requested_at ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Lock a student's test (called from frontend on max violations)
router.post('/lock', verifyToken, async (req, res) => {
    const { courseId, level, reason, violationCount } = req.body;
    const userId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    console.log(`[Lock Request] User: ${userId}, Identifier: ${testIdentifier}, Reason: ${reason}`);

    try {
        // 1. Check if record exists
        const existing = await query(
            "SELECT id FROM test_attendance WHERE user_id = ? AND test_identifier = ? ORDER BY requested_at DESC LIMIT 1",
            [userId, testIdentifier]
        );

        if (existing.length > 0) {
            // Update existing
            await query(`
                UPDATE test_attendance 
                SET locked = 1, locked_at = CURRENT_TIMESTAMP, locked_reason = ?, violation_count = ?
                WHERE id = ?
            `, [reason || 'Max violations reached', violationCount || 0, existing[0].id]);
            console.log(`[Lock] Updated existing record ${existing[0].id}`);
        } else {
            // Create new locked record (likely an admin or bypass user)
            await query(`
                INSERT INTO test_attendance (user_id, test_identifier, status, locked, locked_at, locked_reason, violation_count, approved_at)
                VALUES (?, ?, 'approved', 1, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
            `, [userId, testIdentifier, reason || 'Max violations reached (Bypass)', violationCount || 0]);
            console.log(`[Lock] Created new locked record for bypass user`);
        }

        res.json({ success: true, message: 'Test locked. Waiting for admin decision.' });
    } catch (err) {
        console.error('[Lock] Error:', err);
        res.status(500).json({ error: 'Failed to lock test' });
    }
});

// Admin: Unlock a student's test
router.post('/unlock', verifyAdmin, async (req, res) => {
    const { attendanceId, action } = req.body; // action: 'continue' or 'submit'

    if (!attendanceId) {
        return res.status(400).json({ error: 'attendanceId is required' });
    }

    try {
        if (action === 'submit') {
            // Mark as used (force submit their saved code)
            await query(`
                UPDATE test_attendance 
                SET locked = 0, is_used = 1, locked_reason = 'Admin:submit'
                WHERE id = ?
            `, [attendanceId]);
        } else {
            // Allow them to continue (reset lock, set reason to indicate action)
            await query(`
                UPDATE test_attendance 
                SET locked = 0, locked_at = NULL, locked_reason = 'Admin:continue', violation_count = 0
                WHERE id = ?
            `, [attendanceId]);
        }

        res.json({ success: true, action });
    } catch (err) {
        console.error('[Unlock] Error:', err);
        res.status(500).json({ error: 'Failed to unlock test' });
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

    if (!userId || !courseId || !level) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Check for active global session
        const activeSession = await GlobalSession.findActive(courseId, level);
        const sessionId = activeSession ? activeSession.id : null;

        if (!activeSession) {
            console.log(`[Manual Approve] No active session for ${testIdentifier}. Proceeding with bypass authorization.`);
        }

        // 2. Upsert logic (FIX 1: Handle null session_id safely)
        await query(`
            INSERT INTO test_attendance (user_id, test_identifier, status, approved_at, approved_by, session_id, is_used)
            VALUES (?, ?, 'approved', CURRENT_TIMESTAMP, ?, ?, FALSE)
            ON DUPLICATE KEY UPDATE status = 'approved', is_used = FALSE, approved_at = CURRENT_TIMESTAMP, approved_by = ?, session_id = ?
        `, [userId, testIdentifier, adminId, sessionId, adminId, sessionId]);

        res.json({
            success: true,
            message: sessionId ? `User authorized for session ${sessionId}` : "User authorized (Bypass Mode - No Active Session)"
        });
    } catch (error) {
        console.error('[Manual Approve] Error:', error);
        res.status(500).json({ error: 'Failed to approve attendance: ' + error.message });
    }
});

// Admin: Bulk Proactive Approval (CSV)
router.post('/bulk-approve', verifyAdmin, async (req, res) => {
    const { emails, courseId, level } = req.body; // emails is an array
    const adminId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    if (!emails || !Array.isArray(emails) || !courseId || !level) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        // 1. Get user IDs for these emails
        const users = await query(
            "SELECT id, email FROM users WHERE email IN (?)",
            [emails]
        );

        const results = {
            approved: 0,
            notFound: emails.filter(em => !users.find(u => u.email === em))
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

/**
 * GET /api/attendance/sample/csv
 * Download sample CSV template for bulk authorization
 */
router.get('/sample/csv', (req, res) => {
    try {
        const headers = ['email'];
        const rows = [
            ['student01@example.com'],
            ['student02@example.com'],
            ['student03@example.com']
        ];

        const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_template.csv');
        res.send(csvContent);
    } catch (error) {
        console.error('Template generation error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// --- RECURRING SCHEDULE MANAGEMENT ---

/**
 * GET /api/attendance/schedule
 * Get the current daily recurring schedule
 */
router.get('/schedule', verifyAdmin, async (req, res) => {
    try {
        const schedules = await query("SELECT id, start_time, end_time, is_active FROM daily_schedules ORDER BY start_time ASC");
        res.json(schedules);
    } catch (err) {
        console.error('[Schedule GET] Error:', err);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

/**
 * POST /api/attendance/schedule
 * Update/Set the daily recurring schedule
 */
router.post('/schedule', verifyAdmin, async (req, res) => {
    const { schedules } = req.body; // Expecting an array of {start_time, end_time, is_active}

    if (!schedules || !Array.isArray(schedules)) {
        return res.status(400).json({ error: 'Schedules array is required' });
    }

    try {
        // 1. Clear existing schedules
        await query("DELETE FROM daily_schedules");

        // 2. Insert new list
        if (schedules.length > 0) {
            for (const s of schedules) {
                await query(
                    "INSERT INTO daily_schedules (start_time, end_time, is_active) VALUES (?, ?, ?)",
                    [s.start_time, s.end_time, s.is_active !== undefined ? s.is_active : true]
                );
            }
        }

        res.json({ success: true, message: 'Daily schedules updated successfully' });
    } catch (err) {
        console.error('[Schedule POST] Error:', err);
        res.status(500).json({ error: 'Failed to update schedules' });
    }
});

/**
 * GET /api/attendance/unblocked-list
 * Get all students who are currently unblocked (is_blocked = 0)
 */
router.get('/unblocked-list', verifyAdmin, async (req, res) => {
    try {
        const unblocked = await query(`
            SELECT id, username, full_name, email, roll_no, updated_at 
            FROM users 
            WHERE is_blocked = 0 AND role = 'student'
            ORDER BY updated_at DESC
        `);
        res.json(unblocked);
    } catch (err) {
        console.error('[Unblocked List GET] Error:', err);
        res.status(500).json({ error: 'Failed to fetch unblocked students' });
    }
});

/**
 * GET /api/attendance/active-sessions
 * Get all currently active assessment windows (Manual + Recurring)
 */
router.get('/active-sessions', verifyAdmin, async (req, res) => {
    try {
        const sessions = await GlobalSession.getAllActive();
        res.json(sessions);
    } catch (err) {
        console.error('[Active Sessions GET] Error:', err);
        res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
});

// Upload reference image
router.post('/upload-reference', verifyToken, upload.single('image'), async (req, res) => {
    const { courseId, level } = req.body;
    const userId = req.user.id;
    const testIdentifier = `${courseId}_${level}`;

    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    try {
        const imageUrl = `/reference_images/${req.file.filename}`;

        // Update the latest attendance record
        await query(
            `UPDATE test_attendance 
             SET reference_image = ? 
             WHERE user_id = ? AND test_identifier = ?
             ORDER BY requested_at DESC LIMIT 1`,
            [imageUrl, userId, testIdentifier]
        );

        res.json({ success: true, imageUrl });
    } catch (error) {
        console.error('Reference image upload error:', error);
        res.status(500).json({ error: 'Failed to save reference image' });
    }
});

module.exports = router;
