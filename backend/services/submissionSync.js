const fs = require("fs");
const path = require("path");
const SubmissionModel = require("../models/Submission");

const submissionsPath = path.join(__dirname, "../data/submissions.json");

function loadFallbackSubmissions() {
  try {
    if (!fs.existsSync(submissionsPath)) {
      return [];
    }
    const data = fs.readFileSync(submissionsPath, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.warn("Unable to read fallback submissions JSON:", error.message);
    return [];
  }
}

async function upsertSubmissionIntoDb(submission) {
  if (!submission) return false;

  const formatted = {
    id: submission.id,
    challengeId: submission.challengeId || submission.challenge_id,
    userId: submission.userId || submission.user_id || "user-demo-student",
    candidateName:
      submission.candidateName || submission.candidate_name || "Anonymous",
    code: submission.code || {
      html: submission.html || submission.code_html || "",
      css: submission.css || submission.code_css || "",
      js: submission.js || submission.code_js || "",
    },
    status:
      submission.status ||
      (submission.result?.passed ? "passed" : "failed") ||
      "pending",
    submittedAt:
      submission.submittedAt ||
      submission.submitted_at ||
      new Date().toISOString(),
  };

  if (!formatted.id || !formatted.challengeId) {
    return false;
  }

  const existing = await SubmissionModel.findById(formatted.id);
  if (!existing) {
    await SubmissionModel.create(formatted);
  }

  if (submission.result) {
    await SubmissionModel.updateEvaluation(formatted.id, submission.result);
  }

  return true;
}

async function syncFallbackSubmissions() {
  const fallbackSubmissions = loadFallbackSubmissions();
  if (!fallbackSubmissions.length) {
    return true;
  }

  let syncedCount = 0;
  for (const fallback of fallbackSubmissions) {
    try {
      const synced = await upsertSubmissionIntoDb(fallback);
      if (synced) {
        syncedCount += 1;
      }
    } catch (error) {
      console.error(
        `Failed to sync fallback submission ${fallback?.id}:`,
        error.message
      );
    }
  }

  if (syncedCount > 0) {
    console.log(`🔁 Synced ${syncedCount} fallback submission(s) into MySQL.`);
  }

  return true;
}

function scheduleFallbackSync(intervalMs = 30000) {
  const attemptSync = async () => {
    try {
      await syncFallbackSubmissions();
    } catch (error) {
      console.error("Fallback submission sync error:", error.message);
    }
  };

  attemptSync();
  setInterval(attemptSync, intervalMs).unref();
}

module.exports = {
  loadFallbackSubmissions,
  syncFallbackSubmissions,
  scheduleFallbackSync,
};
