const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../database/connection');
const { verifyAdmin } = require('./users');
const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, '../data/user-progress.json');


/**
 * GET /api/level-access/:userId
 * Get all level access settings for a specific user
 */
router.get('/:userId', verifyAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const levelAccess = await query(
            `SELECT la.*, c.title as course_title, c.total_levels
       FROM level_access la
       JOIN courses c ON la.course_id = c.id
       WHERE la.user_id = ?
       ORDER BY c.title, la.level`,
            [userId]
        );

        res.json(levelAccess);
    } catch (error) {
        console.error('Error fetching level access:', error);
        res.status(500).json({ error: 'Failed to fetch level access' });
    }
});

/**
 * GET /api/level-access/:userId/:courseId
 * Get level access for a specific user and course
 */
router.get('/:userId/:courseId', verifyAdmin, async (req, res) => {
    try {
        const { userId, courseId } = req.params;

        const levelAccess = await query(
            `SELECT * FROM level_access 
       WHERE user_id = ? AND course_id = ?
       ORDER BY level`,
            [userId, courseId]
        );

        res.json(levelAccess);
    } catch (error) {
        console.error('Error fetching course level access:', error);
        res.status(500).json({ error: 'Failed to fetch course level access' });
    }
});

/**
 * POST /api/level-access/lock
 * Lock a specific level for a user
 * Body: { userId, courseId, level, lockedBy }
 */
router.post('/lock', verifyAdmin, async (req, res) => {
    try {
        const { userId, courseId, level, lockedBy } = req.body;

        if (!userId || !courseId || level === undefined) {
            return res.status(400).json({ error: 'userId, courseId, and level are required' });
        }

        // Check if record exists
        const existing = await queryOne(
            'SELECT * FROM level_access WHERE user_id = ? AND course_id = ? AND level = ?',
            [userId, courseId, level]
        );

        if (existing) {
            // Update existing record
            await query(
                `UPDATE level_access 
         SET is_locked = TRUE, locked_by = ?, locked_at = NOW(), unlocked_at = NULL
         WHERE user_id = ? AND course_id = ? AND level = ?`,
                [lockedBy || 'admin', userId, courseId, level]
            );
        } else {
            // Create new record
            const id = `la-${uuidv4()}`;
            await query(
                `INSERT INTO level_access (id, user_id, course_id, level, is_locked, locked_by, locked_at)
         VALUES (?, ?, ?, ?, TRUE, ?, NOW())`,
                [id, userId, courseId, level, lockedBy || 'admin']
            );
        }

        res.json({ message: 'Level locked successfully', userId, courseId, level });
    } catch (error) {
        console.error('Error locking level:', error);
        res.status(500).json({ error: 'Failed to lock level' });
    }
});

/**
 * POST /api/level-access/unlock
 * Unlock a specific level for a user
 * Body: { userId, courseId, level }
 */
router.post('/unlock', verifyAdmin, async (req, res) => {
    try {
        const { userId, courseId, level } = req.body;

        if (!userId || !courseId || level === undefined) {
            return res.status(400).json({ error: 'userId, courseId, and level are required' });
        }

        // Check if record exists
        const existing = await queryOne(
            'SELECT * FROM level_access WHERE user_id = ? AND course_id = ? AND level = ?',
            [userId, courseId, level]
        );

        if (existing) {
            // Update to unlocked
            await query(
                `UPDATE level_access 
         SET is_locked = FALSE, unlocked_at = NOW()
         WHERE user_id = ? AND course_id = ? AND level = ?`,
                [userId, courseId, level]
            );
        } else {
            // Create new record as unlocked (explicitly unlocked)
            const id = `la-${uuidv4()}`;
            await query(
                `INSERT INTO level_access (id, user_id, course_id, level, is_locked, unlocked_at)
         VALUES (?, ?, ?, ?, FALSE, NOW())`,
                [id, userId, courseId, level]
            );
        }

        res.json({ message: 'Level unlocked successfully', userId, courseId, level });
    } catch (error) {
        console.error('Error unlocking level:', error);
        res.status(500).json({ error: 'Failed to unlock level' });
    }
});

/**
 * POST /api/level-access/bulk
 * Bulk lock/unlock levels
 * Body: { userId, courseId, levels: [1,2,3], action: 'lock'|'unlock', lockedBy }
 */
router.post('/bulk', verifyAdmin, async (req, res) => {
    try {
        const { userId, courseId, levels, action, lockedBy } = req.body;

        if (!userId || !courseId || !levels || !Array.isArray(levels) || !action) {
            return res.status(400).json({ error: 'userId, courseId, levels array, and action are required' });
        }

        const results = [];
        for (const level of levels) {
            try {
                if (action === 'lock') {
                    const existing = await queryOne(
                        'SELECT * FROM level_access WHERE user_id = ? AND course_id = ? AND level = ?',
                        [userId, courseId, level]
                    );

                    if (existing) {
                        await query(
                            `UPDATE level_access 
               SET is_locked = TRUE, locked_by = ?, locked_at = NOW(), unlocked_at = NULL
               WHERE user_id = ? AND course_id = ? AND level = ?`,
                            [lockedBy || 'admin', userId, courseId, level]
                        );
                    } else {
                        const id = `la-${uuidv4()}`;
                        await query(
                            `INSERT INTO level_access (id, user_id, course_id, level, is_locked, locked_by, locked_at)
               VALUES (?, ?, ?, ?, TRUE, ?, NOW())`,
                            [id, userId, courseId, level, lockedBy || 'admin']
                        );
                    }
                } else if (action === 'unlock') {
                    const existing = await queryOne(
                        'SELECT * FROM level_access WHERE user_id = ? AND course_id = ? AND level = ?',
                        [userId, courseId, level]
                    );

                    if (existing) {
                        await query(
                            `UPDATE level_access 
               SET is_locked = FALSE, unlocked_at = NOW()
               WHERE user_id = ? AND course_id = ? AND level = ?`,
                            [userId, courseId, level]
                        );
                    }
                }
                results.push({ level, success: true });
            } catch (error) {
                results.push({ level, success: false, error: error.message });
            }
        }

        res.json({ message: `Bulk ${action} completed`, results });
    } catch (error) {
        console.error('Error in bulk operation:', error);
        res.status(500).json({ error: 'Failed to complete bulk operation' });
    }
});

/**
 * DELETE /api/level-access/:userId/:courseId/:level
 * Delete a level access record (remove override, revert to default)
 */
router.delete('/:userId/:courseId/:level', verifyAdmin, async (req, res) => {
    try {
        const { userId, courseId, level } = req.params;

        await query(
            'DELETE FROM level_access WHERE user_id = ? AND course_id = ? AND level = ?',
            [userId, courseId, parseInt(level)]
        );

        res.json({ message: 'Level access record deleted' });
    } catch (error) {
        console.error('Error deleting level access:', error);
        res.status(500).json({ error: 'Failed to delete level access' });
    }
});

/**
 * POST /api/level-access/reset
 * Reset (un-complete) a specific level for a user
 * Body: { userId, courseId, level }
 */
router.post('/reset', verifyAdmin, async (req, res) => {
    try {
        const { userId, courseId, level } = req.body;

        if (!userId || !courseId || level === undefined) {
            return res.status(400).json({ error: 'userId, courseId, and level are required' });
        }

        // Read progress file
        if (!fs.existsSync(progressPath)) {
            return res.status(404).json({ error: 'Progress data not found' });
        }

        const data = fs.readFileSync(progressPath, 'utf8');
        const allProgress = JSON.parse(data);

        const userProgress = allProgress.find(p => p.userId === userId);
        if (!userProgress) {
            return res.status(404).json({ error: 'User progress not found' });
        }

        const courseProgress = userProgress.courses.find(c => c.courseId === courseId);
        if (!courseProgress) {
            return res.status(404).json({ error: 'Course progress not found' });
        }

        // Remove level from completedLevels
        if (courseProgress.completedLevels && courseProgress.completedLevels.includes(level)) {
            courseProgress.completedLevels = courseProgress.completedLevels.filter(l => l !== level);

            // Optional: Adjust currentLevel logic if strictly enforcing sequential progression
            // For now, we just remove the completion record so they can "re-attempt"

            fs.writeFileSync(progressPath, JSON.stringify(allProgress, null, 2));

            console.log(`Reset level ${level} for user ${userId} in course ${courseId}`);
            return res.json({ message: 'Level reset successfully', userId, courseId, level });
        }

        return res.json({ message: 'Level was not completed, no action taken', userId, courseId, level });

    } catch (error) {
        console.error('Error resetting level:', error);
        res.status(500).json({ error: 'Failed to reset level' });
    }
});

module.exports = router;
