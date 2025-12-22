const db = require("../database/connection");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const submissionsPath = path.join(__dirname, "../data/submissions.json");

const loadFallbackSubmissions = () => {
  try {
    if (fs.existsSync(submissionsPath)) {
      return JSON.parse(fs.readFileSync(submissionsPath, "utf8"));
    }
  } catch (error) {
    console.warn("Failed to load submissions fallback JSON:", error.message);
  }
  return [];
};

const mapFallbackSubmission = (submission) => {
  if (!submission) return null;
  const result = submission.result || submission.evaluation_result || {};

  return {
    id: submission.id,
    challenge_id: submission.challengeId || submission.challenge_id || null,
    candidate_name:
      submission.candidateName || submission.candidate_name || "Anonymous",
    status: submission.status || (result.passed ? "passed" : "failed"),
    passed: result.passed || submission.passed ? 1 : 0,
    structure_score: result.structureScore || submission.structure_score || 0,
    visual_score: result.visualScore || submission.visual_score || 0,
    content_score: result.contentScore || submission.content_score || 0,
    final_score: result.finalScore || submission.final_score || 0,
    submitted_at:
      submission.submittedAt ||
      submission.submitted_at ||
      new Date().toISOString(),
    evaluated_at: submission.evaluatedAt || submission.evaluated_at || null,
    evaluation_result: JSON.stringify(result),
  };
};

const mergeWithFallbackSubmissions = (dbSubmissions, submissionIds) => {
  const submissionsMap = new Map(dbSubmissions.map((sub) => [sub.id, sub]));

  if (submissionsMap.size === submissionIds.length) {
    return dbSubmissions;
  }

  const fallbackData = loadFallbackSubmissions();

  submissionIds.forEach((id) => {
    if (!submissionsMap.has(id)) {
      const fallback = fallbackData.find((s) => s.id === id);
      const mapped = mapFallbackSubmission(fallback);
      if (mapped) {
        submissionsMap.set(id, mapped);
      }
    }
  });

  return submissionIds.map((id) => submissionsMap.get(id)).filter(Boolean);
};

class TestSession {
  static async create(sessionData) {
    const id = uuidv4();
    const { user_id, course_id, level, submission_ids = [] } = sessionData;

    const query = `
      INSERT INTO test_sessions (
        id, user_id, course_id, level, submission_ids,
        total_questions, passed_count, overall_status
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 'failed')
    `;

    await db.query(query, [
      id,
      user_id,
      course_id,
      level,
      JSON.stringify(submission_ids),
    ]);

    return this.findById(id);
  }

  static async findById(id) {
    const query = "SELECT * FROM test_sessions WHERE id = ?";
    const rows = await db.query(query, [id]);

    if (rows.length === 0) {
      return null;
    }

    const session = rows[0];

    // Parse JSON fields
    return {
      ...session,
      submission_ids:
        typeof session.submission_ids === "string"
          ? JSON.parse(session.submission_ids)
          : session.submission_ids,
    };
  }

  static async addSubmission(sessionId, submissionId) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error("Test session not found");
    }

    const submissionIds = session.submission_ids || [];
    if (!submissionIds.includes(submissionId)) {
      submissionIds.push(submissionId);
    }

    const query = `
      UPDATE test_sessions 
      SET submission_ids = ?,
          total_questions = ?
      WHERE id = ?
    `;

    await db.query(query, [
      JSON.stringify(submissionIds),
      submissionIds.length,
      sessionId,
    ]);

    return this.findById(sessionId);
  }

  static async complete(sessionId, feedbackData = {}) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error("Test session not found");
    }

    // Get all submissions for this session
    const submissionIds = session.submission_ids || [];
    if (submissionIds.length === 0) {
      throw new Error("No submissions in this test session");
    }

    // Query all submissions to calculate pass/fail
    const placeholders = submissionIds.map(() => "?").join(",");
    const submissionsQuery = `
      SELECT id, status, passed 
      FROM submissions 
      WHERE id IN (${placeholders})
    `;

    let submissions = await db.query(submissionsQuery, submissionIds);
    submissions = mergeWithFallbackSubmissions(submissions, submissionIds);
    if (!submissions.length) {
      throw new Error("Unable to locate submissions for this session");
    }

    // Calculate passed count and overall status
    const passedCount = submissions.filter(
      (s) => s.passed === 1 || s.status === "passed"
    ).length;
    const totalQuestions = submissions.length;
    const overallStatus = passedCount === totalQuestions ? "passed" : "failed";

    // Update test session
    const updateQuery = `
      UPDATE test_sessions 
      SET total_questions = ?,
          passed_count = ?,
          overall_status = ?,
          user_feedback = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.query(updateQuery, [
      totalQuestions,
      passedCount,
      overallStatus,
      feedbackData.user_feedback || null,
      sessionId,
    ]);

    return this.findById(sessionId);
  }

  static async getSessionWithSubmissions(sessionId) {
    const session = await this.findById(sessionId);
    if (!session) {
      return null;
    }

    const submissionIds = session.submission_ids || [];
    if (submissionIds.length === 0) {
      return {
        ...session,
        submissions: [],
      };
    }

    // Get all submission details
    const placeholders = submissionIds.map(() => "?").join(",");
    const query = `
      SELECT 
        id, challenge_id, candidate_name, status, passed,
        structure_score, visual_score, content_score, final_score,
        submitted_at, evaluated_at, evaluation_result
      FROM submissions 
      WHERE id IN (${placeholders})
      ORDER BY submitted_at ASC
    `;

    let submissions = await db.query(query, submissionIds);
    submissions = mergeWithFallbackSubmissions(submissions, submissionIds);

    // Parse evaluation_result JSON
    const parsedSubmissions = submissions.map((sub) => ({
      ...sub,
      evaluation_result:
        typeof sub.evaluation_result === "string"
          ? JSON.parse(sub.evaluation_result)
          : sub.evaluation_result,
    }));

    return {
      ...session,
      submissions: parsedSubmissions,
    };
  }

  static async findByUser(userId, limit = 20) {
    const query = `
      SELECT * FROM test_sessions 
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `;

    const rows = await db.query(query, [userId, limit]);

    return rows.map((session) => ({
      ...session,
      submission_ids:
        typeof session.submission_ids === "string"
          ? JSON.parse(session.submission_ids)
          : session.submission_ids,
    }));
  }
}

module.exports = TestSession;
