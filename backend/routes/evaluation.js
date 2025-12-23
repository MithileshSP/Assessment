/**
 * Evaluation Routes
 * Triggers hybrid evaluation (DOM + Pixel Matching)
 */

const express = require("express");
const router = express.Router();
const evaluator = require("../services/evaluator");
const fs = require("fs");
const path = require("path");
const ChallengeModel = require("../models/Challenge");
const SubmissionModel = require("../models/Submission");

const submissionsPath = path.join(__dirname, "../data/submissions.json");
const challengesPath = path.join(__dirname, "../data/challenges.json");
const challengesNewPath = path.join(__dirname, "../data/challenges-new.json");

// Helper functions
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

const saveSubmissions = (submissions) => {
  try {
    fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));
  } catch (error) {
    console.warn("Failed to save submissions fallback JSON:", error.message);
  }
};

const getChallenges = () => {
  const data = fs.readFileSync(challengesPath, "utf8");
  return JSON.parse(data);
};

// Get challenge from database
const getChallenge = async (challengeId) => {
  try {
    // Get from database
    const challenge = await ChallengeModel.findById(challengeId);

    if (challenge) {
      console.log(`📄 Found challenge in database: ${challengeId}`);
      return challenge;
    }

    // Fallback to JSON files if database fails
    try {
      const oldChallenges = getChallenges();
      let fallbackChallenge = oldChallenges.find((c) => c.id === challengeId);

      if (fallbackChallenge) {
        console.log(`📄 Found challenge in JSON fallback: ${challengeId}`);
        return fallbackChallenge;
      }

      if (fs.existsSync(challengesNewPath)) {
        const newData = fs.readFileSync(challengesNewPath, "utf8");
        const newChallenges = JSON.parse(newData);
        fallbackChallenge = newChallenges.find((c) => c.id === challengeId);

        if (fallbackChallenge) {
          console.log(`📄 Found challenge in new format: ${challengeId}`);
          return fallbackChallenge;
        }
      }
    } catch (jsonError) {
      console.error("JSON fallback failed:", jsonError);
    }

    return null;
  } catch (error) {
    console.error("Error loading challenge:", error);
    return null;
  }
};

const normalizeCodeBlock = (submission = {}) => {
  if (submission.code && typeof submission.code === "object") {
    return {
      html:
        submission.code.html || submission.html || submission.html_code || "",
      css: submission.code.css || submission.css || submission.css_code || "",
      js: submission.code.js || submission.js || submission.js_code || "",
    };
  }

  return {
    html: submission.html || submission.html_code || "",
    css: submission.css || submission.css_code || "",
    js: submission.js || submission.js_code || "",
  };
};

const seedSubmissionIntoDatabase = async (submission) => {
  if (!submission) return false;

  try {
    await SubmissionModel.create({
      id: submission.id,
      challengeId: submission.challengeId || submission.challenge_id,
      userId: submission.userId || submission.user_id || "user-demo-student",
      candidateName:
        submission.candidateName || submission.candidate_name || "Anonymous",
      code: normalizeCodeBlock(submission),
      status: submission.status || "pending",
      submittedAt:
        submission.submittedAt ||
        submission.submitted_at ||
        new Date().toISOString(),
    });
    console.log(`🗄️ Seeded fallback submission ${submission.id} into database`);
    return true;
  } catch (error) {
    console.warn(
      `Failed to seed submission ${submission.id} into database:`,
      error.message
    );
    return false;
  }
};

/**
 * POST /api/evaluate
 * Evaluate a submission using hybrid method
 * Body: { submissionId }
 */
router.post("/", async (req, res) => {
  try {
    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: "Submission ID required" });
    }

    // Get submission - try database first, then JSON fallback
    let submission;
    let submissionFromDb = false;
    try {
      submission = await SubmissionModel.findById(submissionId);
      if (submission) {
        submissionFromDb = true;
      }
    } catch (dbError) {
      console.log("Database lookup failed, using JSON:", dbError.message);
    }

    // Fallback to JSON if not found in database
    if (!submission) {
      const submissions = getSubmissions();
      submission = submissions.find((s) => s.id === submissionId);
    }

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Get challenge with expected solution
    const challenge = await getChallenge(submission.challengeId);

    if (!challenge) {
      console.error(`❌ Challenge not found: ${submission.challengeId}`);
      return res.status(404).json({ error: "Challenge not found" });
    }

    console.log(`\n🔄 Starting evaluation for submission: ${submissionId}`);
    console.log(`📝 Challenge: ${challenge.title}`);

    // Run hybrid evaluation with content validation
    const evaluationResult = await evaluator.evaluate(
      submission.code,
      challenge.expectedSolution,
      challenge.passingThreshold,
      submissionId,
      submission.challengeId // Pass challengeId for content-specific validation
    );

    const persistEvaluationToJson = () => {
      submission.status = evaluationResult.passed ? "passed" : "failed";
      submission.result = evaluationResult;
      submission.evaluatedAt = new Date().toISOString();
      const submissions = getSubmissions();
      const submissionIndex = submissions.findIndex(
        (s) => s.id === submissionId
      );
      if (submissionIndex >= 0) {
        submissions[submissionIndex] = submission;
      } else {
        submissions.push(submission);
      }
      saveSubmissions(submissions);
    };

    if (!submissionFromDb) {
      submissionFromDb = await seedSubmissionIntoDatabase(submission);
    }

    // Update submission with result - try database first
    try {
      if (!submissionFromDb) {
        throw new Error("Submission not available in database");
      }

      const updatedSubmission = await SubmissionModel.updateEvaluation(
        submissionId,
        evaluationResult
      );
      if (!updatedSubmission) {
        throw new Error("Submission not found during evaluation update");
      }
      console.log("✅ Saved evaluation to database");
    } catch (dbError) {
      console.log(
        "Database save failed, using JSON fallback:",
        dbError.message
      );
      persistEvaluationToJson();
    }

    console.log(
      `✅ Evaluation complete: ${evaluationResult.passed ? "PASSED" : "FAILED"}`
    );
    console.log(`   Content: ${evaluationResult.contentScore}%`);
    console.log(`   Structure: ${evaluationResult.structureScore}%`);
    console.log(`   Visual: ${evaluationResult.visualScore}%`);
    console.log(`   Final: ${evaluationResult.finalScore}%\n`);

    res.json({
      message: "Evaluation complete",
      result: evaluationResult,
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    res.status(500).json({
      error: "Evaluation failed",
      details: error.message,
    });
  }
});

/**
 * POST /api/evaluate/quick
 * Quick evaluation without saving submission (for testing)
 * Body: { code: { html, css, js }, challengeId }
 */
router.post("/quick", async (req, res) => {
  try {
    const { code, challengeId } = req.body;

    if (!code || !challengeId) {
      return res.status(400).json({ error: "Code and challenge ID required" });
    }

    // Get challenge
    const challenge = await getChallenge(challengeId);

    if (!challenge) {
      console.error(`❌ Challenge not found: ${challengeId}`);
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Run evaluation
    const evaluationResult = await evaluator.evaluate(
      code,
      challenge.expectedSolution,
      challenge.passingThreshold,
      "quick-test"
    );

    res.json(evaluationResult);
  } catch (error) {
    console.error("Quick evaluation error:", error);
    res.status(500).json({
      error: "Evaluation failed",
      details: error.message,
    });
  }
});

module.exports = router;
