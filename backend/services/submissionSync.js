const fs = require("fs");
const path = require("path");
const SubmissionModel = require("../models/Submission");

const dataDir = path.join(__dirname, "../data");

// Helper to find all submissions_*.json files
function getFallbackFilePaths() {
  try {
    if (!fs.existsSync(dataDir)) return [];
    return fs.readdirSync(dataDir)
      .filter(file => file.startsWith("submissions_") && file.endsWith(".json"))
      .map(file => path.join(dataDir, file));
  } catch (err) {
    console.error("Error scanning data directory:", err.message);
    return [];
  }
}

function loadFallbackSubmissions(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.warn(`Unable to read fallback submissions from ${filePath}:`, error.message);
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
  const filePaths = getFallbackFilePaths();
  if (!filePaths.length) return true;

  console.log(`♻️ Found ${filePaths.length} fallback file(s). Starting reconciliation...`);

  for (const filePath of filePaths) {
    const fallbackSubmissions = loadFallbackSubmissions(filePath);
    if (!fallbackSubmissions.length) {
        // Delete empty or invalid files
        fs.unlinkSync(filePath);
        continue;
    }

    let syncedCount = 0;
    for (const fallback of fallbackSubmissions) {
      try {
        const synced = await upsertSubmissionIntoDb(fallback);
        if (synced) syncedCount += 1;
      } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
          continue; // Skip if referential integrity is missing
        }
        console.error(`Failed to sync submission ${fallback?.id}:`, error.message);
      }
    }

    if (syncedCount > 0) {
      console.log(`✅ Synced ${syncedCount} submissions from ${path.basename(filePath)} into MySQL.`);
      // Safely archive or remove the file after successful processing
      try {
          fs.unlinkSync(filePath); 
      } catch (e) {
          console.warn(`Failed to delete synced file ${filePath}:`, e.message);
      }
    }
  }

  return true;
}

function scheduleFallbackSync(intervalMs = 60000) {
  const attemptSync = async () => {
    try {
      await syncFallbackSubmissions();
    } catch (error) {
      console.error("Fallback sync service error:", error.message);
    }
  };

  // Run first attempt after a short delay (allow DB to stabilize)
  setTimeout(attemptSync, 10000);
  setInterval(attemptSync, intervalMs).unref();
}

module.exports = {
  syncFallbackSubmissions,
  scheduleFallbackSync,
};
