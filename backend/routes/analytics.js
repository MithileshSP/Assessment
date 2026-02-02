const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { verifyAdmin } = require('../middleware/auth');

/**
 * GET /api/admin/analytics/overview
 * Overall stats for the platform
 */
router.get('/overview', verifyAdmin, async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as cleared_counts,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_counts,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_counts
            FROM submissions
        `;
        const [stats] = await db.query(statsQuery);

        const coursePerformanceQuery = `
            SELECT 
                c.id as course_id,
                c.title as course_title,
                COUNT(s.id) as attempts,
                SUM(CASE WHEN s.status = 'passed' THEN 1 ELSE 0 END) as cleared
            FROM courses c
            LEFT JOIN submissions s ON c.id = s.course_id
            GROUP BY c.id, c.title
        `;
        const coursePerformance = await db.query(coursePerformanceQuery);

        res.json({
            overall: stats,
            courses: coursePerformance
        });
    } catch (error) {
        console.error('Analytics overview error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
});

/**
 * GET /api/admin/analytics/history
 * Daily attempts and cleared counts for the last 30 days
 */
router.get('/history', verifyAdmin, async (req, res) => {
    try {
        const historyQuery = `
            SELECT 
                DATE(submitted_at) as date,
                COUNT(*) as attempts,
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as cleared
            FROM submissions
            WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(submitted_at)
            ORDER BY DATE(submitted_at) ASC
        `;
        const history = await db.query(historyQuery);
        res.json(history);
    } catch (error) {
        console.error('Analytics history error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics history' });
    }
});

/**
 * GET /api/admin/analytics/cleared-students
 * List of students who have cleared at least one level
 */
router.get('/cleared-students', verifyAdmin, async (req, res) => {
    try {
        const studentsQuery = `
            SELECT 
                u.id as user_id,
                u.full_name,
                u.email,
                u.roll_no,
                c.title as course_title,
                s.level,
                s.final_score,
                s.submitted_at
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            JOIN courses c ON s.course_id = c.id
            WHERE s.status = 'passed'
            ORDER BY s.submitted_at DESC
        `;
        const students = await db.query(studentsQuery);
        res.json(students);
    } catch (error) {
        console.error('Analytics cleared students error:', error);
        res.status(500).json({ error: 'Failed to fetch cleared students' });
    }
});

/**
 * GET /api/admin/analytics/export/:courseId
 * Export cleared students for a specific course as CSV
 */
router.get('/export/:courseId', verifyAdmin, async (req, res) => {
    const { courseId } = req.params;
    try {
        const exportQuery = `
            SELECT 
                u.full_name as name,
                u.roll_no,
                u.email,
                s.level,
                s.final_score as score,
                s.submitted_at as date
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.course_id = ? AND s.status = 'passed'
            ORDER BY u.full_name ASC, s.level ASC
        `;
        const results = await db.query(exportQuery, [courseId]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'No cleared students found for this course' });
        }

        const headers = ['Name', 'Roll Number', 'Email', 'Level', 'Score', 'Date'];
        const rows = results.map(r => [
            `"${r.name}"`,
            `"${r.roll_no || 'N/A'}"`,
            `"${r.email}"`,
            r.level,
            r.score,
            new Date(r.date).toLocaleDateString()
        ]);

        const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');

        const courseNameQuery = "SELECT title FROM courses WHERE id = ?";
        const [course] = await db.query(courseNameQuery, [courseId]);
        const filename = `${(course?.title || 'course').replace(/\s+/g, '_')}_cleared_students.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    } catch (error) {
        console.error('Analytics export error:', error);
        res.status(500).json({ error: 'Failed to export analytics' });
    }
});

module.exports = router;
