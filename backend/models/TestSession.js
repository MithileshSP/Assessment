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
    } else {
      // If DB has it but it's pending/incomplete, check if fallback has better data
      const dbSub = submissionsMap.get(id);
      if (dbSub.status === 'pending') {
        const fallback = fallbackData.find((s) => s.id === id);
        if (fallback && (fallback.status === 'passed' || fallback.status === 'failed')) {
          console.log(`⚠️ Merging better data from JSON fallback for submission ${id}`);
          const mapped = mapFallbackSubmission(fallback);
          if (mapped) submissionsMap.set(id, mapped);
        }
      }
    }
  });

  return submissionIds.map((id) => submissionsMap.get(id)).filter(Boolean);
};

class TestSession {
  static async create(sessionData) {
    const id = uuidv4();
    const { user_id, course_id, level, submission_ids = [] } = sessionData;

    // Check for existing active session
    const existingRows = await db.query(
      "SELECT * FROM test_sessions WHERE user_id = ? AND course_id = ? AND level = ? AND completed_at IS NULL",
      [user_id, course_id, level]
    );

    if (existingRows.length > 0) {
      return this.findById(existingRows[0].id);
    }

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

    // Fetch submission to know its challenge_id
    const submissionRows = await db.query(
      `SELECT id, challenge_id, submitted_at FROM submissions WHERE id = ?`,
      [submissionId]
    );

    const submissionRecord = submissionRows[0];
    if (!submissionRecord) {
      throw new Error("Submission not found");
    }

    const submissionChallengeId = submissionRecord.challenge_id;

    // Keep only the latest submission per challenge
    const submissionIds = Array.isArray(session.submission_ids)
      ? [...session.submission_ids]
      : [];

    // Remove older submission for same challenge_id, if any
    const filteredIds = [];
    for (const id of submissionIds) {
      if (id === submissionId) {
        continue;
      }

      const existing = await db.query(
        `SELECT challenge_id, submitted_at FROM submissions WHERE id = ?`,
        [id]
      );

      const existingRecord = existing[0];
      if (!existingRecord) continue;

      if (existingRecord.challenge_id === submissionChallengeId) {
        // Keep the newer one between existing and new
        const existingTime = new Date(existingRecord.submitted_at || 0).getTime();
        const newTime = new Date(submissionRecord.submitted_at || 0).getTime();
        if (existingTime > newTime) {
          // Existing is newer; keep it and skip adding new
          return session;
        }
        // Existing is older; drop it
        continue;
      }

      filteredIds.push(id);
    }

    filteredIds.push(submissionId);

    // Ensure uniqueness just in case
    const uniqueIds = Array.from(new Set(filteredIds));

    const query = `
      UPDATE test_sessions 
      SET submission_ids = ?,
          total_questions = ?
      WHERE id = ?
    `;

    await db.query(query, [
      JSON.stringify(uniqueIds),
      uniqueIds.length,
      sessionId,
    ]);

    // Force refresh to ensure we return latest state
    return this.findById(sessionId);
  }

  static async getSubmissionsByIds(submissionIds) {
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return [];
    }

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

    let submissions = [];
    try {
      submissions = await db.query(query, submissionIds);
    } catch (error) {
      console.warn(
        "Primary submissions query failed, reading from JSON fallback:",
        error.message
      );
    }

    const merged = mergeWithFallbackSubmissions(submissions, submissionIds);

    // Deduplicate by challenge_id keeping the latest submitted_at
    const byChallenge = new Map();

    for (const sub of merged) {
      const key = sub.challenge_id || 'unknown';
      const existing = byChallenge.get(key);

      if (!existing) {
        byChallenge.set(key, sub);
        continue;
      }

      const existingTime = new Date(existing.submitted_at || 0).getTime();
      const currentTime = new Date(sub.submitted_at || 0).getTime();

      if (currentTime >= existingTime) {
        byChallenge.set(key, sub);
      }
    }

    return Array.from(byChallenge.values());
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

    const submissions = await this.getSubmissionsByIds(submissionIds);
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

    const submissions = await this.getSubmissionsByIds(submissionIds);

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

  static async findAll(limit = 100) {
    const query = `
      SELECT t.*, u.username, u.full_name, c.title as course_title 
      FROM test_sessions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN courses c ON t.course_id = c.id
      ORDER BY t.started_at DESC
      LIMIT ?
    `;

    const rows = await db.query(query, [limit]);

    return rows.map((session) => ({
      ...session,
      submission_ids:
        typeof session.submission_ids === "string"
          ? JSON.parse(session.submission_ids)
          : session.submission_ids,
    }));
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
