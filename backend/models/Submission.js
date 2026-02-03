/**
 * Submission Model
 * Database operations for submissions table
 */

const { query, queryOne, transaction } = require('../database/connection');

class SubmissionModel {
  static STATUS = {
    QUEUED: 'queued',
    EVALUATING: 'evaluating',
    PASSED: 'passed',
    FAILED: 'failed',
    ERROR: 'error'
  };

  // Get all submissions
  static async findAll() {
    const submissions = await query('SELECT * FROM submissions ORDER BY submitted_at DESC');
    return submissions.map(s => this._formatSubmission(s));
  }

  // Get submission by ID
  static async findById(id) {
    const submission = await queryOne(`
        SELECT s.*, 
               u.full_name as real_name,
               me.total_score as manual_score,
               me.comments as manual_feedback,
               me.code_quality_score,
               me.requirements_score,
               me.expected_output_score,
               fu.full_name as evaluator_name
        FROM submissions s 
        LEFT JOIN users u ON s.user_id = u.id 
        LEFT JOIN manual_evaluations me ON s.id = me.submission_id
        LEFT JOIN users fu ON me.faculty_id = fu.id
        WHERE s.id = ?
    `, [id]);

    if (submission && submission.real_name) {
      submission.candidate_name = submission.real_name;
    }

    return submission ? this._formatSubmission(submission) : null;
  }

  // Get submissions by user
  static async findByUser(userId) {
    const submissions = await query(
      'SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC',
      [userId]
    );
    return submissions.map(s => this._formatSubmission(s));
  }

  // Get submissions by challenge
  static async findByChallenge(challengeId) {
    const submissions = await query(
      'SELECT * FROM submissions WHERE challenge_id = ? ORDER BY submitted_at DESC',
      [challengeId]
    );
    return submissions.map(s => this._formatSubmission(s));
  }

  // Create new submission
  static async create(submissionData) {
    const id = submissionData.id || `sub-${Date.now()}`;

    // Convert ISO datetime to MySQL format (YYYY-MM-DD HH:MM:SS)
    const formatDateTime = (date) => {
      if (!date) return new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (typeof date === 'string') {
        // If already ISO, extract YYYY-MM-DD HH:MM:SS part
        if (date.includes('T')) {
          return date.slice(0, 19).replace('T', ' ');
        }
        return date;
      }
      return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
    };

    const submittedAt = formatDateTime(submissionData.submittedAt);

    const result = await query(
      `INSERT INTO submissions (id, challenge_id, user_id, course_id, level, candidate_name, html_code, css_code, js_code, status, submitted_at, additional_files)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        submissionData.challengeId,
        submissionData.userId || 'user-demo-student',
        submissionData.courseId || null,
        submissionData.level || null,
        submissionData.candidateName || 'Anonymous',
        submissionData.code?.html || '',
        submissionData.code?.css || '',
        submissionData.code?.js || '',
        submissionData.status || SubmissionModel.STATUS.QUEUED,
        submittedAt,
        JSON.stringify(submissionData.code?.additionalFiles || {})
      ]
    );
    console.log(`[SubmissionModel] INSERT result for ${id}:`, result?.affectedRows || result);
    const found = await this.findById(id);
    console.log(`[SubmissionModel] Post-insert findById for ${id}:`, !!found);
    return found;
  }

  // Update submission with evaluation result
  static async updateEvaluation(id, evaluationData) {
    const screenshots = evaluationData.visual?.screenshots || evaluationData.pixel?.screenshots || {};
    let userScreenshot = screenshots.candidate || null;
    let expectedScreenshot = screenshots.expected || null;
    let diffScreenshot = screenshots.diff || null;

    // Truncate to match DB limit (500 chars)
    if (userScreenshot && userScreenshot.length > 500) userScreenshot = userScreenshot.substring(0, 500);
    if (expectedScreenshot && expectedScreenshot.length > 500) expectedScreenshot = expectedScreenshot.substring(0, 500);
    if (diffScreenshot && diffScreenshot.length > 500) diffScreenshot = diffScreenshot.substring(0, 500);

    await query(
      `UPDATE submissions SET
       status = ?,
       evaluated_at = NOW(),
       structure_score = ?,
       visual_score = ?,
       content_score = ?,
       final_score = ?,
       passed = ?,
       evaluation_result = ?,
       user_screenshot = ?,
       expected_screenshot = ?,
       diff_screenshot = ?
       WHERE id = ?`,
      [
        evaluationData.passed ? 'passed' : 'failed',
        evaluationData.structureScore || 0,
        evaluationData.visualScore || 0,
        evaluationData.contentScore || 0,
        evaluationData.finalScore || 0,
        evaluationData.passed || false,
        JSON.stringify(evaluationData),
        userScreenshot,
        expectedScreenshot,
        diffScreenshot,
        id
      ]
    );
    return await this.findById(id);
  }

  // Update submission with admin override
  static async updateOverride(id, status, reason) {
    await query(
      `UPDATE submissions SET
       status = ?,
       admin_override_status = ?,
       admin_override_reason = ?,
       passed = ?
       WHERE id = ?`,
      [
        status,
        status,
        reason,
        status === 'passed',
        id
      ]
    );
    return await this.findById(id);
  }

  // Delete submission
  static async delete(id) {
    await query('DELETE FROM submissions WHERE id = ?', [id]);
  }

  // Get submission count
  static async count() {
    const result = await queryOne('SELECT COUNT(*) as count FROM submissions');
    return result.count;
  }

  // Find next queued submission with atomic locking to prevent race conditions
  static async findNextQueued() {
    return await transaction(async (connection) => {
      // 1. Fetch the next queued submission and lock the row
      const [rows] = await connection.execute(
        'SELECT * FROM submissions WHERE status = ? ORDER BY submitted_at ASC LIMIT 1 FOR UPDATE',
        [this.STATUS.QUEUED]
      );

      const submission = rows[0];
      if (!submission) return null;

      // 2. Immediately mark as evaluating while still in transaction
      await connection.execute(
        'UPDATE submissions SET status = ? WHERE id = ?',
        [this.STATUS.EVALUATING, submission.id]
      );

      return this._formatSubmission(submission);
    });
  }

  // Find submissions currently being evaluated (to check for stuck ones)
  static async findInProgress() {
    const rows = await query(
      'SELECT * FROM submissions WHERE status = ? ORDER BY submitted_at ASC',
      [this.STATUS.EVALUATING]
    );
    return rows.map(s => this._formatSubmission(s));
  }

  // Update submission status
  static async updateStatus(id, status) {
    await query('UPDATE submissions SET status = ? WHERE id = ?', [status, id]);
    return await this.findById(id);
  }

  // Get recent submissions (for dashboard)
  static async getRecent(limit = 10) {
    const submissions = await query(
      'SELECT * FROM submissions ORDER BY submitted_at DESC LIMIT ?',
      [limit]
    );
    return submissions.map(s => this._formatSubmission(s));
  }

  // Format submission for response
  static _formatSubmission(submission) {
    // Convert relative screenshot paths to full URLs for frontend
    const formatScreenshotUrl = (path) => {
      if (!path) return null;
      // If already a full URL, return as-is
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      // Return path as-is (relative path) so frontend uses its own origin
      // Nginx will derive the correct full URL
      return path;
    };

    const finalStatus = submission.manual_score !== null
      ? (submission.admin_override_status !== 'none' ? submission.admin_override_status : submission.status)
      : (['evaluating', 'error', 'queued'].includes(submission.status) ? submission.status : 'pending');

    const isPassed = (submission.manual_score !== null && submission.manual_score >= 50) ||
      (submission.admin_override_status === 'passed');

    return {
      id: submission.id,
      challengeId: submission.challenge_id,
      userId: submission.user_id,
      courseId: submission.course_id,
      level: submission.level,
      candidateName: submission.candidate_name,
      code: {
        html: submission.html_code,
        css: submission.css_code,
        js: submission.js_code,
        additionalFiles: typeof submission.additional_files === 'string'
          ? JSON.parse(submission.additional_files || '{}')
          : (submission.additional_files || {})
      },
      status: finalStatus,
      submittedAt: submission.submitted_at,
      evaluatedAt: submission.evaluated_at,
      user_screenshot: formatScreenshotUrl(submission.user_screenshot),
      expected_screenshot: formatScreenshotUrl(submission.expected_screenshot),
      diff_screenshot: formatScreenshotUrl(submission.diff_screenshot),
      admin_override_status: submission.admin_override_status,
      admin_override_reason: submission.admin_override_reason,
      total_score: submission.final_score || 0,
      manual_score: submission.manual_score,
      manual_feedback: submission.manual_feedback,
      code_quality_score: submission.code_quality_score,
      requirements_score: submission.requirements_score,
      expected_output_score: submission.expected_output_score,
      evaluator_name: submission.evaluator_name,
      passed: isPassed,
      result: submission.evaluation_result ? (
        typeof submission.evaluation_result === 'string'
          ? (() => {
            try {
              const res = JSON.parse(submission.evaluation_result);
              return { ...res, passed: isPassed, finalScore: res.finalScore };
            } catch (e) {
              return { error: 'Invalid result format', raw: submission.evaluation_result };
            }
          })()
          : { ...submission.evaluation_result, passed: isPassed, finalScore: submission.evaluation_result.finalScore }
      ) : {
        structureScore: submission.structure_score || 0,
        visualScore: submission.visual_score || 0,
        contentScore: submission.content_score || 0,
        finalScore: (submission.final_score || 0),
        passed: isPassed,
        feedback: "No automated feedback available."
      }
    };
  }
}

module.exports = SubmissionModel;
