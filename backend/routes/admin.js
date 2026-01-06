/**
 * Admin Routes
 * Handles admin authentication and challenge management
 */

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

// Import models for MySQL support
const SubmissionModel = require("../models/Submission");
const UserModel = require("../models/User");
const TestSession = require("../models/TestSession");
const { USE_JSON } = require("../database/connection");

const usersPath = path.join(__dirname, "../data/users.json");
const challengesPath = path.join(__dirname, "../data/challenges.json");
const submissionsPath = path.join(__dirname, "../data/submissions.json");

// Helper functions
const getUsers = () => {
  const data = fs.readFileSync(usersPath, "utf8");
  return JSON.parse(data);
};

const getChallenges = () => {
  const data = fs.readFileSync(challengesPath, "utf8");
  return JSON.parse(data);
};

const saveChallenges = (challenges) => {
  fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));
};

const getSubmissions = () => {
  try {
    if (!fs.existsSync(submissionsPath)) {
      return [];
    }
    const data = fs.readFileSync(submissionsPath, "utf8");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn("Failed to read submissions fallback JSON:", error.message);
    return [];
  }
};



/**
 * GET /api/admin/challenges
 * Get all challenges with solutions (admin only)
 */
router.get("/challenges", (req, res) => {
  try {
    // TODO: Add token verification middleware
    const challenges = getChallenges();
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

/**
 * POST /api/admin/challenges
 * Create new challenge
 * Body: { challenge object }
 */
router.post("/challenges", (req, res) => {
  try {
    const challenges = getChallenges();

    const newChallenge = {
      id: `ch-${uuidv4().slice(0, 8)}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    challenges.push(newChallenge);
    saveChallenges(challenges);

    res.status(201).json({
      message: "Challenge created",
      challenge: newChallenge,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create challenge" });
  }
});

/**
 * PUT /api/admin/challenges/:id
 * Update existing challenge
 */
router.put("/challenges/:id", (req, res) => {
  try {
    const challenges = getChallenges();
    const index = challenges.findIndex((c) => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    challenges[index] = {
      ...challenges[index],
      ...req.body,
      id: req.params.id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    saveChallenges(challenges);

    res.json({
      message: "Challenge updated",
      challenge: challenges[index],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update challenge" });
  }
});

/**
 * DELETE /api/admin/challenges/:id
 * Delete challenge
 */
router.delete("/challenges/:id", (req, res) => {
  try {
    const challenges = getChallenges();
    const filtered = challenges.filter((c) => c.id !== req.params.id);

    if (filtered.length === challenges.length) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    saveChallenges(filtered);

    res.json({ message: "Challenge deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete challenge" });
  }
});

/**
 * GET /api/admin/submissions
 * Get all submissions with results
 */
router.get("/submissions", async (req, res) => {
  try {
    if (!USE_JSON) {
      try {
        const submissions = await SubmissionModel.findAll();
        if (submissions && submissions.length) {
          return res.json(submissions);
        }

        const fallbackSubmissions = getSubmissions();
        if (fallbackSubmissions.length) {
          console.warn(
            "MySQL returned no submissions. Serving fallback JSON data instead."
          );
          return res.json(fallbackSubmissions);
        }

        return res.json(submissions || []);
      } catch (dbError) {
        console.error(
          "Failed to fetch submissions from MySQL, attempting JSON fallback:",
          dbError.message
        );
        const fallbackSubmissions = getSubmissions();
        if (fallbackSubmissions.length) {
          return res.json(fallbackSubmissions);
        }
        return res.status(500).json({ error: "Failed to fetch submissions" });
      }
    }

    const submissions = getSubmissions();
    return res.json(submissions);
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

/**
 * POST /api/admin/evaluate/:submissionId
 * Re-run evaluation for a submission
 */
router.post("/evaluate/:submissionId", async (req, res) => {
  try {
    const evaluator = require("../services/evaluator");
    const submissions = getSubmissions();
    const challenges = getChallenges();

    const submission = submissions.find(
      (s) => s.id === req.params.submissionId
    );
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const challenge = challenges.find((c) => c.id === submission.challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Re-evaluate
    const result = await evaluator.evaluate(
      submission.code,
      challenge.expectedSolution,
      challenge.passingThreshold,
      submission.id
    );

    // Update submission
    submission.result = result;
    submission.status = result.passed ? "passed" : "failed";
    submission.evaluatedAt = new Date().toISOString();

    const index = submissions.findIndex(
      (s) => s.id === req.params.submissionId
    );
    submissions[index] = submission;
    fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));

    res.json({ message: "Re-evaluation complete", result });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Re-evaluation failed", details: error.message });
  }
});

/**
 * GET /api/admin/submissions/grouped
 * Get submissions grouped by test session with user details
 */
router.get("/submissions/grouped", async (req, res) => {
  try {
    if (USE_JSON) {
      // When running in JSON-only mode we cannot group by test sessions reliably
      return res.json([]);
    }

    const db = require("../database/connection");

    const query = `
      SELECT 
        ts.id as session_id,
        ts.user_id,
        ts.course_id,
        ts.level,
        ts.started_at,
        ts.completed_at,
        ts.total_questions,
        ts.passed_count,
        ts.overall_status,
        ts.user_feedback,
        COALESCE(u.full_name, u.username, ts.user_id) as user_name,
        u.email as user_email,
        ts.submission_ids
      FROM test_sessions ts
      LEFT JOIN users u ON ts.user_id = u.id
      ORDER BY ts.started_at DESC
    `;

    const sessions = await db.query(query);

    const normalizeSubmissionIds = (rawSubmissionIds) => {
      if (!rawSubmissionIds) return [];

      if (Array.isArray(rawSubmissionIds)) {
        return rawSubmissionIds.filter(Boolean);
      }
      if (typeof rawSubmissionIds === "string") {
        try {
          const parsed = JSON.parse(rawSubmissionIds);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (error) {
          console.error("Error parsing submission_ids string:", error);
          return [];
        }
      }
      if (Buffer.isBuffer(rawSubmissionIds)) {
        try {
          const parsed = JSON.parse(rawSubmissionIds.toString("utf8"));
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (error) {
          console.error("Error parsing submission_ids buffer:", error);
          return [];
        }
      }
      if (typeof rawSubmissionIds === "object") {
        const values = Array.isArray(rawSubmissionIds)
          ? rawSubmissionIds
          : Object.values(rawSubmissionIds);
        return values.filter(Boolean);
      }
      return [];
    };

    const groupedSessions = await Promise.all(
      sessions.map(async (session) => {
        const submissionIds = normalizeSubmissionIds(session.submission_ids);
        const submissions = await TestSession.getSubmissionsByIds(
          submissionIds
        );

        // Skip empty sessions (no submissions stored)
        if (!submissions || submissions.length === 0) {
          return null;
        }

        return {
          session_id: session.session_id,
          user: {
            id: session.user_id,
            name: session.user_name,
            email: session.user_email || "N/A",
          },
          course_id: session.course_id,
          level: session.level,
          started_at: session.started_at,
          completed_at: session.completed_at,
          total_questions: session.total_questions || submissions.length,
          passed_count:
            session.passed_count ||
            submissions.filter(
              (sub) => sub.passed === 1 || sub.status === "passed"
            ).length,
          overall_status: session.overall_status,
          user_feedback: session.user_feedback,
          submissions: submissions.map((s) => ({
            id: s.id,
            challenge_id: s.challenge_id,
            status: s.status,
            passed: s.passed === 1 || s.status === "passed",
            final_score: s.final_score || 0,
            submitted_at: s.submitted_at,
          })),
        };
      })
    );

    // Remove nulls for empty sessions
    res.json(groupedSessions.filter(Boolean));
  } catch (error) {
    console.error("Failed to fetch grouped submissions:", error);
    res.status(500).json({
      error: "Failed to fetch grouped submissions",
      details: error.message,
    });
  }
});

/**
 * DELETE /api/admin/submissions/:id
 * Delete a submission
 */
router.delete("/submissions/:id", async (req, res) => {
  try {
    if (USE_JSON) {
      const submissions = getSubmissions();
      const filtered = submissions.filter((s) => s.id !== req.params.id);

      if (filtered.length === submissions.length) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Save updated submissions
      fs.writeFileSync(submissionsPath, JSON.stringify(filtered, null, 2));
    } else {
      // Delete from MySQL
      const submission = await SubmissionModel.findById(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      await SubmissionModel.delete(req.params.id);
    }

    // Optional: Delete associated screenshot files
    const screenshotDir = path.join(__dirname, "../screenshots");
    try {
      const screenshotFiles = [
        `${req.params.id}-candidate.png`,
        `${req.params.id}-expected.png`,
        `${req.params.id}-diff.png`,
      ];

      screenshotFiles.forEach((file) => {
        const filePath = path.join(screenshotDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (screenshotError) {
      console.warn("Failed to delete screenshots:", screenshotError.message);
      // Don't fail the request if screenshot deletion fails
    }

    res.json({ message: "Submission deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete submission" });
  }
});

module.exports = router;
