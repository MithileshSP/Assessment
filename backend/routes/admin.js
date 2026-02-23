const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { verifyAdmin } = require('../middleware/auth');
const GlobalSession = require('../models/GlobalSession');

// Helper: Log assignment action for audit trail
async function logAssignment(conn, { submissionId, actionType, fromFacultyId, toFacultyId, adminId, notes }) {
  const sql = `INSERT INTO assignment_logs (submission_id, action_type, from_faculty_id, to_faculty_id, admin_id, notes) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [submissionId, actionType, fromFacultyId || null, toFacultyId || null, adminId || null, notes || null];
  if (conn && conn.execute) {
    await conn.execute(sql, params);
  } else {
    await db.query(sql, params);
  }
}

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

// Get all faculty members with work load stats (v3.5.0: includes availability, capacity, current_load)
router.get('/faculty-load', verifyAdmin, async (req, res) => {
  try {
    const facultyUsers = await db.query(
      "SELECT id, username, full_name, email, last_login, is_available, max_capacity FROM users WHERE role = 'faculty'"
    );

    const facultyMap = {};
    facultyUsers.forEach(f => {
      facultyMap[f.id] = {
        ...f,
        is_available: !!f.is_available,
        max_capacity: f.max_capacity || 10,
        pending: 0,
        completed: 0,
        total: 0,
        current_load: 0,
        courses: []
      };
    });

    const assignments = await db.query(
      `SELECT faculty_id, status, COUNT(*) as count 
       FROM submission_assignments 
       GROUP BY faculty_id, status`
    );

    assignments.forEach(row => {
      if (facultyMap[row.faculty_id]) {
        if (['pending', 'assigned', 'in_progress'].includes(row.status)) {
          facultyMap[row.faculty_id].pending += row.count;
          facultyMap[row.faculty_id].current_load += row.count;
        }
        if (row.status === 'evaluated') facultyMap[row.faculty_id].completed += row.count;
        facultyMap[row.faculty_id].total += row.count;
      }
    });

    const courseAssignments = await db.query(
      `SELECT fca.faculty_id, c.title 
       FROM faculty_course_assignments fca
       JOIN courses c ON fca.course_id = c.id`
    );

    courseAssignments.forEach(row => {
      if (facultyMap[row.faculty_id]) {
        facultyMap[row.faculty_id].courses.push(row.title);
      }
    });

    res.json(Object.values(facultyMap));
  } catch (error) {
    console.error("Error fetching faculty load:", error);
    res.status(500).json({ error: error.message });
  }
});

// Smart Auto-Assign (v3.5.0: least-loaded + capacity-aware + audit logged)
router.post('/assign/smart', verifyAdmin, async (req, res) => {
  try {
    const adminId = req.user?.id;

    // 1. Get all unassigned pending/queued submissions
    const unassignedSubmissions = await db.query(`
      SELECT s.id 
      FROM submissions s
      LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
      WHERE s.status IN ('pending', 'queued') AND sa.id IS NULL
      ORDER BY s.submitted_at ASC
    `);

    if (unassignedSubmissions.length === 0) {
      return res.json({ message: "No unassigned submissions found.", assignedCount: 0 });
    }

    // 2. Get available faculty with current load, sorted by least loaded
    const availableFaculty = await db.query(`
      SELECT u.id, u.max_capacity,
        (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') as current_load
      FROM users u
      WHERE u.role = 'faculty' AND u.is_available = TRUE
      HAVING current_load < u.max_capacity
      ORDER BY current_load ASC
    `);

    if (availableFaculty.length === 0) {
      return res.status(400).json({
        error: "No available faculty with capacity found.",
        warning: "All faculty are either unavailable or at max capacity."
      });
    }

    // 3. Smart distribution: always assign to least-loaded faculty
    let assignedCount = 0;
    const loadTracker = {};
    availableFaculty.forEach(f => { loadTracker[f.id] = f.current_load; });

    await db.transaction(async (conn) => {
      for (const sub of unassignedSubmissions) {
        // Find faculty with least current load that still has capacity
        let bestFaculty = null;
        let minLoad = Infinity;
        for (const f of availableFaculty) {
          const load = loadTracker[f.id] || 0;
          if (load < f.max_capacity && load < minLoad) {
            minLoad = load;
            bestFaculty = f;
          }
        }

        if (!bestFaculty) break; // No more capacity

        await conn.execute(
          `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status) 
           VALUES (?, ?, NOW(), 'pending')
           ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
          [sub.id, bestFaculty.id]
        );

        await logAssignment(conn, {
          submissionId: sub.id,
          actionType: 'auto_assign',
          toFacultyId: bestFaculty.id,
          adminId,
          notes: 'Bulk smart auto-assign'
        });

        loadTracker[bestFaculty.id] = (loadTracker[bestFaculty.id] || 0) + 1;
        assignedCount++;
      }
    });

    res.json({
      message: "Smart auto-assignment complete",
      assignedCount,
      skipped: unassignedSubmissions.length - assignedCount
    });

  } catch (error) {
    console.error("Error running auto-assign:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned submissions (v3.5.0)
router.get('/unassigned-submissions', verifyAdmin, async (req, res) => {
  try {
    const submissions = await db.query(`
      SELECT s.id, s.user_id, u.full_name as student_name, u.email as student_email,
             s.course_id, c.title as course_title, s.level, s.challenge_id,
             ch.title as challenge_title, s.submitted_at, s.status
      FROM submissions s
      LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN challenges ch ON s.challenge_id = ch.id
      WHERE sa.id IS NULL AND s.status IN ('pending', 'queued')
      ORDER BY s.submitted_at ASC
    `);
    res.json(submissions);
  } catch (error) {
    console.error("Error fetching unassigned submissions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Manual assign single submission to faculty (v3.5.0)
router.post('/assign/manual', verifyAdmin, async (req, res) => {
  try {
    const { submissionId, facultyId } = req.body;
    const adminId = req.user?.id;

    if (!submissionId || !facultyId) {
      return res.status(400).json({ error: 'submissionId and facultyId are required' });
    }

    // Validate faculty exists and check capacity
    const faculty = await db.queryOne(
      `SELECT id, max_capacity, is_available,
        (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = users.id AND sa.status = 'pending') as current_load
       FROM users WHERE id = ? AND role = 'faculty'`, [facultyId]
    );

    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    if (!faculty.is_available) return res.status(400).json({ error: 'Faculty is currently unavailable' });
    if (faculty.current_load >= faculty.max_capacity) {
      return res.status(400).json({ error: 'Faculty is at max capacity', current_load: faculty.current_load, max_capacity: faculty.max_capacity });
    }

    // Validate submission exists
    const submission = await db.queryOne('SELECT id FROM submissions WHERE id = ?', [submissionId]);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status)
         VALUES (?, ?, NOW(), 'pending')
         ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW(), status = 'pending'`,
        [submissionId, facultyId]
      );
      await logAssignment(conn, {
        submissionId, actionType: 'manual_assign', toFacultyId: facultyId, adminId,
        notes: 'Manual assignment by admin'
      });
    });

    res.json({ message: 'Submission assigned successfully', submissionId, facultyId });
  } catch (error) {
    console.error("Manual assign error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reassign submission to different faculty (v3.5.0)
router.post('/assign/reassign', verifyAdmin, async (req, res) => {
  try {
    const { submissionId, newFacultyId } = req.body;
    const adminId = req.user?.id;

    if (!submissionId || !newFacultyId) {
      return res.status(400).json({ error: 'submissionId and newFacultyId are required' });
    }

    // Get current assignment
    const currentAssignment = await db.queryOne(
      'SELECT faculty_id FROM submission_assignments WHERE submission_id = ?', [submissionId]
    );
    const fromFacultyId = currentAssignment?.faculty_id || null;

    if (fromFacultyId === newFacultyId) {
      return res.status(400).json({ error: 'Submission is already assigned to this faculty' });
    }

    // Check new faculty capacity
    const newFaculty = await db.queryOne(
      `SELECT id, max_capacity, is_available,
        (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = users.id AND sa.status = 'pending') as current_load
       FROM users WHERE id = ? AND role = 'faculty'`, [newFacultyId]
    );

    if (!newFaculty) return res.status(404).json({ error: 'Target faculty not found' });
    if (!newFaculty.is_available) return res.status(400).json({ error: 'Target faculty is unavailable' });
    if (newFaculty.current_load >= newFaculty.max_capacity) {
      return res.status(400).json({ error: 'Target faculty is at max capacity' });
    }

    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO submission_assignments (submission_id, faculty_id, assigned_at, status)
         VALUES (?, ?, NOW(), 'pending')
         ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), assigned_at = NOW()`,
        [submissionId, newFacultyId]
      );
      await logAssignment(conn, {
        submissionId, actionType: 'reassign', fromFacultyId, toFacultyId: newFacultyId, adminId,
        notes: `Reassigned from ${fromFacultyId || 'unassigned'} to ${newFacultyId}`
      });
    });

    res.json({ message: 'Submission reassigned successfully', submissionId, fromFacultyId, newFacultyId });
  } catch (error) {
    console.error("Reassign error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Redistribute a faculty's pending queue to available faculty (v3.5.0)
router.post('/assign/redistribute', verifyAdmin, async (req, res) => {
  try {
    const { fromFacultyId } = req.body;
    const adminId = req.user?.id;

    if (!fromFacultyId) {
      return res.status(400).json({ error: 'fromFacultyId is required' });
    }

    // Get pending submissions for this faculty
    const pendingSubmissions = await db.query(
      `SELECT submission_id FROM submission_assignments WHERE faculty_id = ? AND status = 'pending' ORDER BY assigned_at ASC`,
      [fromFacultyId]
    );

    if (pendingSubmissions.length === 0) {
      return res.json({ message: 'No pending submissions to redistribute', redistributedCount: 0 });
    }

    // Get available faculty (excluding the source), sorted by least loaded
    const availableFaculty = await db.query(`
      SELECT u.id, u.max_capacity,
        (SELECT COUNT(*) FROM submission_assignments sa WHERE sa.faculty_id = u.id AND sa.status = 'pending') as current_load
      FROM users u
      WHERE u.role = 'faculty' AND u.is_available = TRUE AND u.id != ?
      HAVING current_load < u.max_capacity
      ORDER BY current_load ASC
    `, [fromFacultyId]);

    if (availableFaculty.length === 0) {
      return res.status(400).json({
        error: 'No available faculty with capacity to redistribute to',
        warning: 'All other faculty are either unavailable or at max capacity'
      });
    }

    let redistributedCount = 0;
    const loadTracker = {};
    availableFaculty.forEach(f => { loadTracker[f.id] = f.current_load; });

    await db.transaction(async (conn) => {
      for (const sub of pendingSubmissions) {
        // Find least-loaded faculty with capacity
        let bestFaculty = null;
        let minLoad = Infinity;
        for (const f of availableFaculty) {
          const load = loadTracker[f.id] || 0;
          if (load < f.max_capacity && load < minLoad) {
            minLoad = load;
            bestFaculty = f;
          }
        }

        if (!bestFaculty) break; // No more capacity

        await conn.execute(
          'UPDATE submission_assignments SET faculty_id = ?, assigned_at = NOW() WHERE submission_id = ?',
          [bestFaculty.id, sub.submission_id]
        );

        await logAssignment(conn, {
          submissionId: sub.submission_id,
          actionType: 'redistribute',
          fromFacultyId,
          toFacultyId: bestFaculty.id,
          adminId,
          notes: `Redistributed from absent faculty ${fromFacultyId}`
        });

        loadTracker[bestFaculty.id] = (loadTracker[bestFaculty.id] || 0) + 1;
        redistributedCount++;
      }
    });

    res.json({
      message: `Redistributed ${redistributedCount} submissions`,
      redistributedCount,
      skipped: pendingSubmissions.length - redistributedCount
    });
  } catch (error) {
    console.error("Redistribute error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle faculty availability (v3.5.0)
router.patch('/faculty/:id/availability', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable (boolean) is required' });
    }

    const faculty = await db.queryOne('SELECT id FROM users WHERE id = ? AND role = ?', [id, 'faculty']);
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

    await db.query('UPDATE users SET is_available = ? WHERE id = ?', [isAvailable, id]);
    res.json({ message: `Faculty availability set to ${isAvailable}`, facultyId: id, isAvailable });
  } catch (error) {
    console.error("Availability toggle error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update faculty max capacity (v3.5.0)
router.patch('/faculty/:id/capacity', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { maxCapacity } = req.body;

    if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 100) {
      return res.status(400).json({ error: 'maxCapacity must be an integer between 1 and 100' });
    }

    const faculty = await db.queryOne('SELECT id FROM users WHERE id = ? AND role = ?', [id, 'faculty']);
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

    await db.query('UPDATE users SET max_capacity = ? WHERE id = ?', [maxCapacity, id]);
    res.json({ message: 'Capacity updated', facultyId: id, maxCapacity });
  } catch (error) {
    console.error("Capacity update error:", error);
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
                (me.code_quality_score + me.requirements_score + me.expected_output_score) as manual_score,
                me.code_quality_score, me.requirements_score, me.expected_output_score,
                ue.username as evaluator_name,
                c.title as course_title,
                s.level
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN manual_evaluations me ON s.id = me.submission_id
            LEFT JOIN users ue ON me.faculty_id = ue.id
            LEFT JOIN courses c ON s.course_id = c.id
            WHERE s.status != 'saved'
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
        u.roll_no,
        u.full_name as student_name,
        u.email as student_email,
        c.title as course_name,
        s.status as status,
        COALESCE((me.code_quality_score + me.requirements_score + me.expected_output_score), s.final_score, 0) as score,
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
    const headers = ['Roll No', 'Student Name', 'Email', 'Course', 'Status', 'Code Quality', 'Key Requirements', 'Output Score', 'Total Score', 'Faculty Feedback', 'Test Date'];
    const csvRows = [headers.join(',')];

    const submissionIds = [];
    for (const row of results) {
      submissionIds.push(row.id);
      const testDate = row.test_date ? new Date(row.test_date).toLocaleDateString('en-IN') : '';
      const csvRow = [
        `="${(row.roll_no || '').replace(/"/g, '""')}"`, // Use ="text" to preserve leading zeros in Excel
        `"${(row.student_name || 'Anonymous').replace(/"/g, '""')}"`,
        `"${(row.student_email || '').replace(/"/g, '""')}"`,
        `"${(row.course_name || 'N/A').replace(/"/g, '""')}"`,
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
 * DELETE /api/admin/results/bulk
 * Bulk delete submissions by date range
 */
router.delete('/results/bulk', verifyAdmin, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate && !toDate) {
      return res.status(400).json({ error: 'At least one date filter (fromDate or toDate) is required for bulk delete.' });
    }

    // Build WHERE conditions
    let whereConditions = [];
    const queryParams = [];

    if (fromDate) {
      whereConditions.push('DATE(submitted_at) >= ?');
      queryParams.push(fromDate);
    }
    if (toDate) {
      whereConditions.push('DATE(submitted_at) <= ?');
      queryParams.push(toDate);
    }

    const whereClause = whereConditions.join(' AND ');

    // 1. Get IDs to be deleted
    const selectQuery = `SELECT id FROM submissions WHERE ${whereClause}`;
    const submissionsToDelete = await db.query(selectQuery, queryParams);

    if (submissionsToDelete.length === 0) {
      return res.json({ message: 'No submissions found for the selected date range.', count: 0 });
    }

    const submissionIds = submissionsToDelete.map(s => s.id);

    // 2. Delete related records
    // Manual Evaluations
    await db.query(`DELETE FROM manual_evaluations WHERE submission_id IN (?)`, [submissionIds]);

    // Submission Assignments
    await db.query(`DELETE FROM submission_assignments WHERE submission_id IN (?)`, [submissionIds]);

    // 3. Delete Submissions
    await db.query(`DELETE FROM submissions WHERE id IN (?)`, [submissionIds]);

    console.log(`[BulkDelete] Deleted ${submissionIds.length} submissions.`);

    res.json({
      message: `Successfully deleted ${submissionIds.length} submissions.`,
      count: submissionIds.length
    });

  } catch (error) {
    console.error("Error in bulk delete:", error);
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

    // 10. Delete from level_completions table (CRITICAL FIX for course completion status)
    try {
      await db.query(
        `DELETE FROM level_completions WHERE user_id = ? AND course_id = ? AND level = ?`,
        [userId, courseId, levelNum]
      );
    } catch (e) {
      console.warn('level_completions cleanup failed:', e.message);
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
    res.status(500).json({ error: error.message || 'Failed to apply override' });
  }
});

// ─────────────────────────────────────────────────────────────
// ENTERPRISE ENDPOINTS (v4.0)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/bulk-assign
 * Assign multiple submissions to a single faculty member.
 * Uses FOR UPDATE on both faculty row AND submission rows.
 * Returns 200 (all success) or 207 (partial success).
 */
router.post('/bulk-assign', verifyAdmin, async (req, res) => {
  try {
    const { submissionIds, facultyId } = req.body;
    const adminId = req.user?.id;

    if (!Array.isArray(submissionIds) || submissionIds.length === 0 || !facultyId) {
      return res.status(400).json({ error: 'submissionIds (array) and facultyId are required' });
    }

    const assigned = [];
    const errors = [];

    await db.transaction(async (conn) => {
      // 1. Lock faculty row & validate capacity
      const [faculty] = await conn.execute(
        `SELECT id, max_capacity, is_available,
          (SELECT COALESCE(SUM(submission_weight), 0) FROM submission_assignments
           WHERE faculty_id = ? AND status IN ('assigned','in_progress')) as effective_load
         FROM users WHERE id = ? AND role = 'faculty' FOR UPDATE`,
        [facultyId, facultyId]
      );

      if (!faculty || faculty.length === 0) {
        throw new Error('Faculty not found');
      }
      const fac = faculty[0] || faculty;
      if (!fac.is_available) {
        throw new Error('Faculty is currently unavailable');
      }

      let currentLoad = parseInt(fac.effective_load) || 0;
      const maxCap = parseInt(fac.max_capacity) || 10;

      // 2. Lock existing submission assignment rows
      const existingAssignments = await conn.execute(
        `SELECT submission_id, id, version, status FROM submission_assignments
         WHERE submission_id IN (${submissionIds.map(() => '?').join(',')}) FOR UPDATE`,
        submissionIds
      );
      const existingMap = {};
      const existArr = Array.isArray(existingAssignments[0]) ? existingAssignments[0] : (existingAssignments || []);
      existArr.forEach(row => { existingMap[row.submission_id] = row; });

      // 3. Process each submission
      for (const subId of submissionIds) {
        // Capacity check
        if (currentLoad >= maxCap) {
          errors.push({ id: subId, reason: 'Faculty at max capacity' });
          continue;
        }

        const existing = existingMap[subId];

        if (existing) {
          // Already assigned — check if can reassign
          if (existing.status === 'evaluated') {
            errors.push({ id: subId, reason: 'Already evaluated' });
            continue;
          }
          if (existing.faculty_id === facultyId) {
            errors.push({ id: subId, reason: 'Already assigned to this faculty' });
            continue;
          }

          // Reassign with optimistic lock
          const [updateResult] = await conn.execute(
            `UPDATE submission_assignments
             SET faculty_id = ?, status = 'assigned', version = version + 1,
                 locked_by = NULL, locked_at = NULL
             WHERE id = ? AND version = ?`,
            [facultyId, existing.id, existing.version]
          );

          if ((updateResult.affectedRows || updateResult) === 0) {
            errors.push({ id: subId, reason: 'Version conflict — modified by another user' });
            continue;
          }
        } else {
          // Verify submission exists
          const [sub] = await conn.execute(
            'SELECT id FROM submissions WHERE id = ?', [subId]
          );
          if (!sub || (Array.isArray(sub) && sub.length === 0)) {
            errors.push({ id: subId, reason: 'Submission not found' });
            continue;
          }

          // New assignment
          await conn.execute(
            `INSERT INTO submission_assignments
             (submission_id, faculty_id, assigned_at, status, version, submission_weight)
             VALUES (?, ?, NOW(), 'assigned', 1, 1)
             ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), status = 'assigned',
               version = version + 1, assigned_at = NOW(), locked_by = NULL, locked_at = NULL`,
            [subId, facultyId]
          );
        }

        // Log the assignment
        await logAssignment(conn, {
          submissionId: subId,
          actionType: 'bulk_assign',
          toFacultyId: facultyId,
          adminId,
          notes: 'Bulk assignment by admin'
        });

        currentLoad++;
        assigned.push(subId);
      }

      // 4. Update derived load cache
      await conn.execute(
        `UPDATE users SET current_load = (
          SELECT COALESCE(SUM(submission_weight), 0)
          FROM submission_assignments
          WHERE faculty_id = ? AND status IN ('assigned','in_progress')
        ) WHERE id = ?`,
        [facultyId, facultyId]
      );
    });

    const statusCode = errors.length > 0 && assigned.length > 0 ? 207 : 200;
    res.status(statusCode).json({
      assigned: assigned.length,
      skipped: errors.length,
      assignedIds: assigned,
      errors
    });
  } catch (error) {
    console.error("Bulk assign error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/all-submissions
 * Server-paginated list of all submissions with assignment status + faculty info.
 * Query params: page, limit, status, courseId, level, search, sortBy, sortDir
 */
router.get('/all-submissions', verifyAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const { status, courseId, level, search, sortBy, sortDir } = req.query;

    // Build WHERE
    const conditions = ["s.status != 'saved'"];
    const params = [];

    if (status) {
      conditions.push('sa.status = ?');
      params.push(status);
    }
    if (courseId) {
      conditions.push('s.course_id = ?');
      params.push(courseId);
    }
    if (level) {
      conditions.push('s.level = ?');
      params.push(parseInt(level));
    }
    if (search) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR s.id LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.join(' AND ');

    // Valid sort columns
    const validSorts = {
      submitted_at: 's.submitted_at',
      student_name: 'u.full_name',
      course: 'c.title',
      level: 's.level',
      status: 'sa.status',
      faculty: 'f.full_name'
    };
    const orderCol = validSorts[sortBy] || 's.submitted_at';
    const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM submissions s
      LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN users f ON sa.faculty_id = f.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);
    const total = countResult?.total || countResult?.count || 0;

    // Data query
    const dataQuery = `
      SELECT
        s.id, s.user_id, u.full_name as student_name, u.email as student_email,
        s.course_id, c.title as course_title, s.level,
        s.challenge_id, ch.title as challenge_title,
        s.submitted_at, s.status as submission_status,
        sa.id as assignment_id, sa.faculty_id, sa.status as assignment_status,
        sa.version, sa.locked_by, sa.locked_at, sa.reallocation_count,
        sa.submission_weight,
        f.full_name as faculty_name, f.email as faculty_email
      FROM submissions s
      LEFT JOIN submission_assignments sa ON s.id = sa.submission_id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN users f ON sa.faculty_id = f.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN challenges ch ON s.challenge_id = ch.id
      WHERE ${whereClause}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT ? OFFSET ?
    `;

    const rows = await db.query(dataQuery, [...params, limit, offset]);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("All submissions error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/assignment-logs
 * Paginated and filterable audit log.
 * Query params: page, limit, facultyId, actionType, fromDate, toDate
 */
router.get('/assignment-logs', verifyAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { facultyId, actionType, fromDate, toDate } = req.query;

    const conditions = [];
    const params = [];

    if (facultyId) {
      conditions.push('(al.from_faculty_id = ? OR al.to_faculty_id = ?)');
      params.push(facultyId, facultyId);
    }
    if (actionType) {
      conditions.push('al.action_type = ?');
      params.push(actionType);
    }
    if (fromDate) {
      conditions.push('DATE(al.created_at) >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('DATE(al.created_at) <= ?');
      params.push(toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM assignment_logs al ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Data
    const rows = await db.query(
      `SELECT al.*,
        ff.full_name as from_faculty_name,
        tf.full_name as to_faculty_name,
        adm.full_name as admin_name,
        s.candidate_name as student_name
      FROM assignment_logs al
      LEFT JOIN users ff ON al.from_faculty_id = ff.id
      LEFT JOIN users tf ON al.to_faculty_id = tf.id
      LEFT JOIN users adm ON al.admin_id = adm.id
      LEFT JOIN submissions s ON al.submission_id = s.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error("Assignment logs error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
