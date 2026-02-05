const { queryOne } = require('../database/connection');

/**
 * checkPrerequisites
 * Middleware to ensure the user has completed the prerequisite course 
 * before accessing the current course's content.
 */
const checkPrerequisites = async (req, res, next) => {
    // Admin bypass
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    try {
        const { courseId } = req.query; // Assuming courseId is in query for GET requests
        const userId = req.user.id;

        if (!courseId) {
            // If courseId is in params (e.g. /:courseId/...)
            if (req.params.courseId) {
                req.query.courseId = req.params.courseId; // Normalize
            } else {
                return next(); // Let validation in route handle missing param
            }
        }

        const targetCourseId = courseId || req.params.courseId;

        // 1. Get Course Prerequisite
        const course = await queryOne("SELECT title, prerequisite_course_id FROM courses WHERE id = ?", [targetCourseId]);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const prerequisiteId = course.prerequisite_course_id;

        // If no prerequisite, allow access
        if (!prerequisiteId) {
            return next();
        }

        // 2. Check if User has completed the prerequisite
        // We check 'user_progress', 'level_completions', or 'test_sessions'
        // Ideally, 'user_progress' completion implies success.

        // Strategy: Check if the user has passed the prerequisite course in `test_sessions` (most authoritative for exams)
        // OR if they have a "passed" entry in `level_completions` for that course (if we treat it as 1 level)

        const completion = await queryOne(`
            SELECT 1 
            FROM test_sessions 
            WHERE user_id = ? AND course_id = ? AND overall_status = 'passed'
            LIMIT 1
        `, [userId, prerequisiteId]);

        // Alternative: Check user_progress if test_session isn't used for everything
        // But for "Exam Portal", test_session pass is the gold standard.

        if (!completion) {
            // Double check legacy tables just in case (optional, but safer during migration)
            const legacyCompletion = await queryOne(`
                SELECT 1
                FROM level_completions
                WHERE user_id = ? AND course_id = ? AND passed = 1
                LIMIT 1
             `, [userId, prerequisiteId]);

            if (!legacyCompletion) {
                // Prerequisite NOT met
                const prereqCourse = await queryOne("SELECT title FROM courses WHERE id = ?", [prerequisiteId]);
                const prereqTitle = prereqCourse ? prereqCourse.title : prerequisiteId;

                return res.status(403).json({
                    error: 'Prerequisite Not Met',
                    message: `You must complete "${prereqTitle}" before accessing "${course.title}".`
                });
            }
        }

        // Prerequisite met
        next();

    } catch (error) {
        console.error('[Prerequisite Check] Error:', error);
        res.status(500).json({ error: 'Failed to verify prerequisites' });
    }
};

module.exports = { checkPrerequisites };
