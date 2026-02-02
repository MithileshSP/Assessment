const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { verifyAdmin } = require('../middleware/auth');
const GlobalSession = require('../models/GlobalSession');

/**
 * GET /api/admin/sessions/active
 * Get active session for a course/level
 */
router.get('/sessions/active', verifyAdmin, async (req, res) => {
  const { courseId, level } = req.query;
  try {
    const session = await GlobalSession.findActive(courseId, level);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Platform Stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [userCount] = await db.query("SELECT COUNT(*) as count FROM users");
    const [courseCount] = await db.query("SELECT COUNT(*) as count FROM courses");
    const [submissionCount] = await db.query("SELECT COUNT(*) as count FROM submissions");
    const [pendingAttendance] = await db.query("SELECT COUNT(*) as count FROM test_attendance WHERE status = 'requested'");
    const [pendingEvaluations] = await db.query("SELECT COUNT(*) as count FROM submission_assignments WHERE status = 'pending'");

    res.json({
      totalUsers: userCount.count,
      totalCourses: courseCount.count,
      totalSubmissions: submissionCount.count,
      pendingAttendance: pendingAttendance.count,
      pendingEvaluations: pendingEvaluations.count
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all submissions
router.get('/submissions', verifyAdmin, async (req, res) => {
  try {
    const SubmissionModel = require('../models/Submission');
    const submissions = await SubmissionModel.findAll();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all faculty members with work load stats
router.get('/faculty-load', verifyAdmin, async (req, res) => {
  try {
    // Get all faculty users
    const facultyUsers = await db.query(
      "SELECT id, username, full_name, email FROM users WHERE role = 'faculty'"
    );

    // Get submission counts for each faculty
    const facultyStart = {};
    facultyUsers.forEach(f => {
      facultyStart[f.id] = { ...f, pending: 0, completed: 0, total: 0 };
    });

    const assignments = await db.query(
      `SELECT faculty_id, status, COUNT(*) as count 
             FROM submission_assignments 
             GROUP BY faculty_id, status`
    );

    assignments.forEach(row => {
      if (facultyStart[row.faculty_id]) {
        if (row.status === 'pending') facultyStart[row.faculty_id].pending += row.count;
        if (row.status === 'evaluated') facultyStart[row.faculty_id].completed += row.count;
        facultyStart[row.faculty_id].total += row.count;
      }
    });

    res.json(Object.values(facultyStart));
  } catch (error) {
    console.error("Error fetching faculty load:", error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-Assign Round Robin
router.post('/assign/auto', verifyAdmin, async (req, res) => {
  try {
    // 1. Get all unassigned pending submissions
    const unassignedQuery = `
            SELECT s.id 
            FROM submissions s
            LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
            WHERE s.status = 'pending' AND sa.id IS NULL
            ORDER BY s.submitted_at ASC
        `;
    const unassignedSubmissions = await db.query(unassignedQuery);

    if (unassignedSubmissions.length === 0) {
      return res.json({ message: "No unassigned submissions found.", assignedCount: 0 });
    }

    // 2. Get all faculty
    const facultyUsers = await db.query("SELECT id FROM users WHERE role = 'faculty'");
    if (facultyUsers.length === 0) {
      return res.status(400).json({ error: "No faculty members found to assign to." });
    }

    // 3. Round Robin Distribution
    let assignments = [];
    let facultyIndex = 0;

    for (const sub of unassignedSubmissions) {
      const facultyId = facultyUsers[facultyIndex].id;
      assignments.push([sub.id, facultyId]);
      facultyIndex = (facultyIndex + 1) % facultyUsers.length;
    }

    // 4. Bulk Insert
    // Note: mysql2/promise execute doesnt support bulk insert easily with placeholder array of arrays
    // We will loop for simplicity or construct a big query. Loop is safer for now.
    let assignedCount = 0;
    for (const [subId, facId] of assignments) {
      await db.query(
        "INSERT INTO submission_assignments (submission_id, faculty_id) VALUES (?, ?)",
        [subId, facId]
      );
      assignedCount++;
    }

    res.json({ message: "Auto-assignment complete", assignedCount });

  } catch (error) {
    console.error("Error running auto-assign:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Aggregated Results (Auto + Manual)
router.get('/results', verifyAdmin, async (req, res) => {
  try {
    const query = `
            SELECT 
                s.id, s.candidate_name, s.submitted_at, s.status as final_status,
                s.structure_score, s.visual_score, s.content_score, s.final_score as auto_score,
                me.total_score as manual_score,
                me.code_quality_score, me.requirements_score, me.expected_output_score,
                u.username as evaluator_name,
                c.title as course_title,
                t.level
            FROM submissions s
            LEFT JOIN manual_evaluations me ON s.id = me.submission_id
            LEFT JOIN users u ON me.faculty_id = u.id
            LEFT JOIN courses c ON s.course_id = c.id
            LEFT JOIN test_sessions t ON s.id = JSON_UNQUOTE(JSON_EXTRACT(t.submission_ids, '$[0]')) -- Approximation if 1 sub per session
            ORDER BY s.submitted_at DESC
        `;

    // Note: test_sessions join is tricky with JSON arrays. 
    // Better to just show course/level from submission table if available (it is).
    const simplerQuery = `
            SELECT 
                s.id, u.full_name as candidate_name, s.submitted_at, s.status as final_status,
                s.final_score as auto_score,
                me.total_score as manual_score,
                me.code_quality_score, me.requirements_score, me.expected_output_score,
                ue.username as evaluator_name,
                c.title as course_title,
                s.level
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN manual_evaluations me ON s.id = me.submission_id
            LEFT JOIN users ue ON me.faculty_id = ue.id
            LEFT JOIN courses c ON s.course_id = c.id
            ORDER BY s.submitted_at DESC
        `;

    const results = await db.query(simplerQuery);
    res.json(results);
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/results/export
 * Export unexported results as CSV and mark them as exported
 */
router.get('/results/export', verifyAdmin, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Build WHERE conditions
    let whereConditions = ['s.exported_at IS NULL'];
    const queryParams = [];

    if (fromDate) {
      whereConditions.push('DATE(s.submitted_at) >= ?');
      queryParams.push(fromDate);
    }
    if (toDate) {
      whereConditions.push('DATE(s.submitted_at) <= ?');
      queryParams.push(toDate);
    }

    // Query unexported submissions with all required fields
    const exportQuery = `
      SELECT 
        s.id,
        s.user_id as student_uid,
        u.full_name as student_name,
        u.email as student_email,
        c.title as course_name,
        s.level as level_name,
        s.status as status,
        COALESCE(me.total_score, s.final_score, 0) as score,
        me.code_quality_score,
        me.requirements_score,
        me.expected_output_score,
        me.comments as faculty_feedback,
        s.submitted_at as test_date
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN manual_evaluations me ON s.id = me.submission_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY s.submitted_at DESC
    `;

    const results = await db.query(exportQuery, queryParams);

    if (results.length === 0) {
      return res.status(200).json({
        message: 'No new submissions to export',
        exported: 0
      });
    }

    // Build CSV content
    const headers = ['Student UID', 'Student Name', 'Email', 'Course', 'Level', 'Status', 'Code Quality', 'Key Requirements', 'Output Score', 'Total Score', 'Faculty Feedback', 'Test Date'];
    const csvRows = [headers.join(',')];

    const submissionIds = [];
    for (const row of results) {
      submissionIds.push(row.id);
      const testDate = row.test_date ? new Date(row.test_date).toLocaleDateString('en-IN') : '';
      const csvRow = [
        `"${(row.student_uid || '').replace(/"/g, '""')}"`,
        `"${(row.student_name || 'Anonymous').replace(/"/g, '""')}"`,
        `"${(row.student_email || '').replace(/"/g, '""')}"`,
        `"${(row.course_name || 'N/A').replace(/"/g, '""')}"`,
        `Level ${row.level_name || 1}`,
        row.status === 'passed' ? 'PASS' : 'FAIL',
        row.code_quality_score || 0,
        row.requirements_score || 0,
        row.expected_output_score || 0,
        row.score || 0,
        `"${(row.faculty_feedback || '').replace(/"/g, '""')}"`,
        testDate
      ];
      csvRows.push(csvRow.join(','));
    }

    // Mark submissions as exported
    if (submissionIds.length > 0) {
      await db.query(
        `UPDATE submissions SET exported_at = NOW() WHERE id IN (?)`,
        [submissionIds]
      );
    }

    // Send CSV response
    const csvContent = csvRows.join('\n');
    const filename = `results_export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Exported-Count', results.length);
    res.send(csvContent);

  } catch (error) {
    console.error("Error exporting results:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /reset-level
 * Reset a user's level progress for re-testing
 * Body: { userId, courseId, level }
 */
router.post('/reset-level', verifyAdmin, async (req, res) => {
  const { userId, courseId, level } = req.body;

  if (!userId || !courseId || level === undefined) {
    return res.status(400).json({ error: 'userId, courseId, and level are required' });
  }

  const fs = require('fs');
  const path = require('path');
  const progressPath = path.join(__dirname, '../data/user-progress.json');

  try {
    const levelNum = parseInt(level);

    // 1. Delete submissions for this user/course/level
    const deletedSubs = await db.query(
      `SELECT id FROM submissions WHERE user_id = ? AND course_id = ? AND level = ?`,
      [userId, courseId, levelNum]
    );

    const submissionIds = deletedSubs.map(s => s.id);

    if (submissionIds.length > 0) {
      // 2. Delete related manual evaluations
      await db.query(
        `DELETE FROM manual_evaluations WHERE submission_id IN (?)`,
        [submissionIds]
      );

      // 3. Delete related submission assignments
      await db.query(
        `DELETE FROM submission_assignments WHERE submission_id IN (?)`,
        [submissionIds]
      );

      // 4. Delete the submissions themselves
      await db.query(
        `DELETE FROM submissions WHERE user_id = ? AND course_id = ? AND level = ?`,
        [userId, courseId, levelNum]
      );
    }

    // 5. Delete user_assignments (question-to-user mapping) for this level
    try {
      await db.query(
        `DELETE FROM user_assignments WHERE user_id = ? AND course_id = ? AND level = ?`,
        [userId, courseId, levelNum]
      );
    } catch (e) {
      console.warn('user_assignments cleanup skipped:', e.message);
    }

    // 6. Delete test_sessions for this level
    try {
      await db.query(
        `DELETE FROM test_sessions WHERE user_id = ? AND course_id = ? AND level = ?`,
        [userId, courseId, levelNum]
      );
    } catch (e) {
      console.warn('test_sessions cleanup skipped:', e.message);
    }

    // 7. Delete test_attendance for this level
    try {
      const testIdentifier = `${courseId}_${levelNum}`;
      await db.query(
        `DELETE FROM test_attendance WHERE user_id = ? AND test_identifier = ?`,
        [userId, testIdentifier]
      );
    } catch (e) {
      console.warn('test_attendance cleanup skipped:', e.message);
    }

    // 8. Clear user-assignments.json (JSON file used by challenges.js)
    const assignmentsPath = path.join(__dirname, '../data/user-assignments.json');
    if (fs.existsSync(assignmentsPath)) {
      try {
        const rawAssignments = fs.readFileSync(assignmentsPath, 'utf8');
        let assignments = JSON.parse(rawAssignments);

        // Remove assignment for this user/course/level
        const assignmentKey = `${userId}-${courseId}-${levelNum}`;
        const beforeCount = assignments.length;
        assignments = assignments.filter(a => a.key !== assignmentKey);

        if (assignments.length < beforeCount) {
          fs.writeFileSync(assignmentsPath, JSON.stringify(assignments, null, 2));
          console.log(`Removed assignment ${assignmentKey} from user-assignments.json`);
        }
      } catch (jsonErr) {
        console.warn('user-assignments.json cleanup failed:', jsonErr.message);
      }
    }

    // 9. Update user_progress in MySQL if it exists
    const existingProgress = await db.queryOne(
      `SELECT id, completed_levels FROM user_progress WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );

    if (existingProgress) {
      let completedLevels = [];
      try {
        completedLevels = JSON.parse(existingProgress.completed_levels || '[]');
        if (!Array.isArray(completedLevels)) completedLevels = [];
      } catch (e) {
        completedLevels = [];
      }

      // Remove the target level from completed_levels
      completedLevels = completedLevels.filter(lv => lv !== levelNum);

      // Recalculate current_level (should be max of completed + 1, or just the target level if empty)
      const newCurrentLevel = completedLevels.length > 0 ? Math.max(...completedLevels) + 1 : 1;

      await db.query(
        `UPDATE user_progress SET completed_levels = ?, current_level = ? WHERE id = ?`,
        [JSON.stringify(completedLevels), Math.min(newCurrentLevel, levelNum), existingProgress.id]
      );
    }

    // 6. Update user-progress.json (legacy sync)
    if (fs.existsSync(progressPath)) {
      try {
        const rawData = fs.readFileSync(progressPath, 'utf8');
        const allProgress = JSON.parse(rawData);

        const userProgress = allProgress.find(p => p.userId === userId);
        if (userProgress) {
          const courseProgress = userProgress.courses?.find(c => c.courseId === courseId);
          if (courseProgress && courseProgress.completedLevels) {
            courseProgress.completedLevels = courseProgress.completedLevels.filter(lv => lv !== levelNum);
            courseProgress.currentLevel = Math.min(courseProgress.currentLevel || 1, levelNum);

            // Remove related question results
            if (courseProgress.completedQuestions) {
              courseProgress.completedQuestions = courseProgress.completedQuestions.filter(
                q => q.level !== levelNum
              );
            }

            fs.writeFileSync(progressPath, JSON.stringify(allProgress, null, 2));
          }
        }
      } catch (jsonErr) {
        console.warn('JSON progress update failed:', jsonErr.message);
      }
    }

    console.log(`Level ${levelNum} reset for user ${userId} in course ${courseId}`);
    res.json({
      message: 'Level reset successfully',
      userId,
      courseId,
      level: levelNum,
      submissionsDeleted: submissionIds.length
    });

  } catch (error) {
    console.error('Error resetting level:', error);
    res.status(500).json({ error: 'Failed to reset level: ' + error.message });
  }
});

/**
 * POST /api/admin/submissions/:id/override
 * Manually override a submission result (Admin only)
 */
router.post('/submissions/:id/override', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status || !reason) {
    return res.status(400).json({ error: 'Status and reason are required' });
  }

  try {
    const SubmissionModel = require('../models/Submission');
    const updated = await SubmissionModel.updateOverride(id, status, reason);

    if (!updated) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({ message: 'Override applied successfully', submission: updated });
  } catch (error) {
    console.error('Override error:', error);
    res.status(500).json({ error: 'Failed to apply override' });
  }
});

module.exports = router;
