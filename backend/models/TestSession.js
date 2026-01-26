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
    console.log('[TestSession] Creating session with data:', sessionData);
    const { user_id, course_id, level, submission_ids = [] } = sessionData;

    // Verify user exists to prevent FK violation
    const user = await db.queryOne("SELECT id FROM users WHERE id = ?", [user_id]);
    if (!user) {
      console.error(`[TestSession] CRITICAL: User ${user_id} not found in database!`);
      throw new Error(`User ${user_id} does not exist. Please log in again.`);
    }

    const id = uuidv4();

    // Check for existing active session
    const existingRows = await db.query(
      "SELECT * FROM test_sessions WHERE user_id = ? AND course_id = ? AND level = ? AND completed_at IS NULL",
      [user_id, course_id, level]
    );

    if (existingRows.length > 0) {
      return this.findById(existingRows[0].id);
    }

    try {
      const query = `
        INSERT INTO test_sessions (
          id, user_id, course_id, level, submission_ids,
          total_questions, passed_count, overall_status
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 'pending')
      `;

      await db.query(query, [
        id,
        user_id,
        course_id,
        level,
        JSON.stringify(submission_ids),
      ]);
    } catch (dbError) {
      console.error('[TestSession] INSERT FAILED:', dbError.message);
      console.error('[TestSession] Failed data:', { id, user_id, course_id, level });
      throw dbError;
    }

    // Track attempt started (FIX 3)
    try {
      // Find the most recent active attendance (or any approved one if session_id is missing)
      await db.query(`
        UPDATE test_attendance 
        SET attempt_started_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND test_identifier = ? AND is_used = FALSE
        ORDER BY requested_at DESC LIMIT 1
      `, [user_id, `${course_id}_${level}`]);
    } catch (e) {
      console.warn("Failed to update attempt_started_at:", e.message);
    }

    return this.findById(id);
  }

  static async findById(id) {
    const query = "SELECT * FROM test_sessions WHERE id = ?";
    const rows = await db.query(query, [id]);

    if (rows.length === 0) {
      return null;
    }

    const session = rows[0];
    let submissionIds = [];
    try {
      submissionIds = typeof session.submission_ids === "string"
        ? JSON.parse(session.submission_ids || "[]")
        : (session.submission_ids || []);
      if (!Array.isArray(submissionIds)) submissionIds = [];
    } catch (e) {
      console.error(`❌ Failed to parse submission_ids for session ${id}:`, e.message);
      submissionIds = [];
    }

    // Parse JSON fields
    return {
      ...session,
      submission_ids: submissionIds
    };
  }

  static async addSubmission(sessionId, submissionId) {
    console.log(`[TestSession] Adding submission ${submissionId} to session ${sessionId}`);
    const session = await this.findById(sessionId);
    if (!session) {
      console.error(`[TestSession] Session ${sessionId} not found`);
      throw new Error("Test session not found");
    }

    // Fetch the new submission to know its challenge_id
    let newSub = null;
    try {
      const newSubRows = await db.query(
        `SELECT id, challenge_id, submitted_at FROM submissions WHERE id = ?`,
        [submissionId]
      );
      newSub = newSubRows[0];
    } catch (e) {
      console.warn("DB fetch failed for new submission, checking fallback");
    }

    if (!newSub) {
      const fallbackData = loadFallbackSubmissions();
      const fallback = fallbackData.find(s => s.id === submissionId);
      if (fallback) {
        newSub = mapFallbackSubmission(fallback);
        console.log(`📄 Found submission ${submissionId} in JSON fallback for addSubmission`);
      }
    }

    if (!newSub) {
      console.error(`[TestSession] Failed to locate submission ${submissionId} in DB or Fallback`);
      throw new Error(`Submission ${submissionId} not found in DB or Fallback`);
    }
    console.log(`[TestSession] Found submission info for ${submissionId}, challenge: ${newSub.challenge_id}`);

    const currentIds = (Array.isArray(session.submission_ids)
      ? session.submission_ids
      : []).filter(Boolean);

    // If session has no submissions yet, just add this one
    if (currentIds.length === 0) {
      const uniqueIds = [submissionId];
      await db.query(
        "UPDATE test_sessions SET submission_ids = ?, total_questions = ? WHERE id = ?",
        [JSON.stringify(uniqueIds), 1, sessionId]
      );
      return this.findById(sessionId);
    }

    // Fetch all existing submissions in this session to handle deduplication by challenge_id
    let existingSubs = [];
    if (currentIds.length > 0) {
      try {
        const placeholders = currentIds.map(() => "?").join(",");
        existingSubs = await db.query(
          `SELECT id, challenge_id, submitted_at FROM submissions WHERE id IN (${placeholders})`,
          currentIds
        );
      } catch (e) {
        console.warn("DB fetch failed for session submissions, using fallback mechanism");
      }
    }

    // Ensure we have data for all IDs (check fallback if DB missed some)
    existingSubs = mergeWithFallbackSubmissions(existingSubs, currentIds);

    // Map by challenge_id to keep only the latest
    const challengeMap = new Map();
    existingSubs.forEach(sub => {
      const key = sub.challenge_id || sub.id;
      challengeMap.set(key, sub);
    });

    // Check if we have a Newer submission for this challenge
    const existingForChallenge = challengeMap.get(newSub.challenge_id);
    if (existingForChallenge) {
      const existingTime = new Date(existingForChallenge.submitted_at || 0).getTime();
      const newTime = new Date(newSub.submitted_at || 0).getTime();

      if (newTime >= existingTime) {
        challengeMap.set(newSub.challenge_id, newSub);
      }
    } else {
      challengeMap.set(newSub.challenge_id, newSub);
    }

    const updatedIds = Array.from(challengeMap.values()).map(s => s.id);
    const uniqueIds = Array.from(new Set(updatedIds));

    console.log(`[TestSession] Preparing update for session ${sessionId}`);
    const updateQuery = `
      UPDATE test_sessions 
      SET submission_ids = ?,
          total_questions = ?
      WHERE id = ?
    `;

    console.log(`[TestSession] Updating session ${sessionId} with ${uniqueIds.length} submissions: ${JSON.stringify(uniqueIds)}`);
    try {
      const updateResult = await db.query(updateQuery, [
        JSON.stringify(uniqueIds),
        uniqueIds.length,
        sessionId,
      ]);
      console.log(`[TestSession] Successfully updated session ${sessionId}. Affected rows:`, updateResult?.affectedRows);
    } catch (updateError) {
      console.error(`[TestSession] Update query failed for session ${sessionId}:`, updateError.message);
      console.error(`[TestSession] SQL Query: ${updateQuery}`);
      console.error(`[TestSession] Params:`, [JSON.stringify(uniqueIds), uniqueIds.length, sessionId]);
      throw updateError;
    }

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
      // Don't throw 500 if no submissions yet, just mark as completed with 0 results
      console.warn(`⚠️ Completing session ${sessionId} with zero submissions.`);
    }

    const submissions = submissionIds.length > 0 ? await this.getSubmissionsByIds(submissionIds) : [];

    // Calculate passed count and overall status
    const passedCount = submissions.filter(
      (s) => s && (s.passed === 1 || s.status === "passed")
    ).length;
    const totalQuestions = submissions.length || 0;
    const overallStatus = (totalQuestions > 0 && passedCount === totalQuestions) ? "passed" : "failed";

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

    // Track attempt submission and mark used (FIX 3 & 4)
    try {
      await db.query(`
        UPDATE test_attendance 
        SET attempt_submitted_at = CURRENT_TIMESTAMP, is_used = TRUE 
        WHERE user_id = ? AND test_identifier = ? AND is_used = FALSE
        ORDER BY requested_at DESC LIMIT 1
      `, [session.user_id, `${session.course_id}_${session.level}`]);
    } catch (e) {
      console.warn("Failed to mark attendance as used:", e.message);
    }

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

    return rows.map((session) => {
      let submissionIds = [];
      try {
        submissionIds = typeof session.submission_ids === "string"
          ? JSON.parse(session.submission_ids || "[]")
          : (session.submission_ids || []);
        if (!Array.isArray(submissionIds)) submissionIds = [];
      } catch (e) {
        submissionIds = [];
      }
      return {
        ...session,
        submission_ids: submissionIds,
      };
    });
  }

  static async findByUser(userId, limit = 20) {
    const query = `
      SELECT * FROM test_sessions 
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `;

    const rows = await db.query(query, [userId, limit]);

    return rows.map((session) => {
      let submissionIds = [];
      try {
        submissionIds = typeof session.submission_ids === "string"
          ? JSON.parse(session.submission_ids || "[]")
          : (session.submission_ids || []);
        if (!Array.isArray(submissionIds)) submissionIds = [];
      } catch (e) {
        submissionIds = [];
      }
      return {
        ...session,
        submission_ids: submissionIds,
      };
    });
  }
}

module.exports = TestSession;
