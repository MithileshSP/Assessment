/**
 * Challenges Routes
 * Handles challenge retrieval for candidates
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ChallengeModel = require('../models/Challenge');
const ChallengeAssignment = require('../models/ChallengeAssignment');
const { query } = require('../database/connection');

const challengesPath = path.join(__dirname, '../data/challenges-new.json');
const assignmentsPath = path.join(__dirname, '../data/user-assignments.json');

// Helper to load JSON files
const loadJSON = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return [];
  }
};

// Helper to save JSON files
const saveJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
};

// Helper to get all challenges
const getAllChallenges = () => {
  return loadJSON(challengesPath);
};

// Helper to get assignments
const getAssignments = () => {
  return loadJSON(assignmentsPath);
};

// Helper to save assignments
const saveAssignments = (assignments) => {
  return saveJSON(assignmentsPath, assignments);
};

/**
 * GET /api/challenges
 * Get all challenges (without solutions for candidates)
 */
router.get('/', async (req, res) => {
  try {
    let challenges;
    try {
      challenges = await ChallengeModel.findAll();
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      challenges = loadJSON(challengesPath);
    }

    // Remove expected solutions for candidate view
    const publicChallenges = challenges.map(challenge => ({
      id: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty,
      description: challenge.description,
      instructions: challenge.instructions,
      tags: challenge.tags || [],
      timeLimit: challenge.timeLimit || challenge.time_limit,
      passingThreshold: challenge.passingThreshold || {},
      courseId: challenge.courseId || challenge.course_id,
      level: challenge.level,
      assets: challenge.assets || { images: [], reference: '' }
    }));

    res.json(publicChallenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

/**
 * GET /api/challenges/course/:courseId/export/csv
 * Export all questions for a specific course as CSV (Admin/Faculty only)
 */
router.get('/course/:courseId/export/csv', async (req, res) => {
  try {
    const { courseId } = req.params;
    let challenges;
    try {
      challenges = await ChallengeModel.findByCourse(courseId);
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      const allChallenges = loadJSON(challengesPath);
      challenges = allChallenges.filter(c => c.courseId === courseId);
    }

    if (!challenges || challenges.length === 0) {
      return res.status(404).send('No challenges found for this course');
    }

    // Convert to CSV
    const headers = [
      'id', 'courseId', 'level', 'title', 'description', 'instructions',
      'tags', 'assets', 'expectedHtml', 'expectedCss', 'expectedJs',
      'points', 'passingThreshold', 'challengeType'
    ];

    // Helper to quote string if needed
    const quote = (str) => {
      if (str === null || str === undefined) return '';
      const stringField = String(str);
      // Handle HTML/code with standard CSV escaping
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\t')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // Header row
    let csvContent = headers.join(',') + '\n';

    // Data rows
    challenges.forEach(challenge => {
      const row = headers.map(header => {
        let value = challenge[header];

        // Handle nested fields from mapper if necessary
        if (value === undefined && (header === 'expectedHtml' || header === 'expectedCss' || header === 'expectedJs')) {
          const solutionField = header.replace('expected', '').toLowerCase();
          value = challenge.expectedSolution ? challenge.expectedSolution[solutionField] : '';
        }

        if (value === null || value === undefined) value = '';

        // Handle arrays/objects
        if (typeof value === 'object') {
          // Special handling for legacy asset string format if preferred, or just JSON
          value = JSON.stringify(value);
        }

        return quote(value);
      });
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=questions_export_${courseId}.csv`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error exporting challenges:', error);
    res.status(500).send('Failed to export challenges');
  }
});

const { verifyToken } = require('../middleware/auth');
const { checkPrerequisites } = require('../middleware/prerequisites');

/**
 * GET /api/challenges/level-questions
 * Get assigned questions for a user's level with random assignment
 * ENFORCES ATTENDANCE CHECK
 */
router.get('/level-questions', verifyToken, checkPrerequisites, async (req, res) => {
  try {
    const { courseId, level, forceNew } = req.query; // level is deprecated/optional
    const userId = req.user.id; // Use ID from token for security

    if (!courseId) {
      return res.status(400).json({ error: 'Missing required parameters: courseId' });
    }

    // --- ENFORCE ATTENDANCE CHECK (LINEAR SKILL PATH) ---
    // Test identifier is now just the courseId, as each course = 1 unique level
    const testIdentifier = courseId;

    // Check both attendance record AND global user block status
    const [user] = await query("SELECT is_blocked FROM users WHERE id = ?", [userId]);
    const attendance = await query(
      "SELECT status FROM test_attendance WHERE user_id = ? AND test_identifier = ?",
      [userId, testIdentifier]
    );

    const isGlobalUnblocked = user && user.is_blocked === 0;
    const isAttendanceApproved = attendance.length > 0 && attendance[0].status === 'approved';
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isGlobalUnblocked && !isAttendanceApproved) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You have not been authorized to attend this test. Please wait for an administrator to unblock you.',
        status: attendance.length > 0 ? attendance[0].status : 'none'
      });
    }
    // --------------------------------

    // --------------------------------

    // 0. Fetch completed questions (Source of Truth) - Moved up for filtering
    const completedRows = await query(
      `SELECT DISTINCT challenge_id FROM submissions 
       WHERE user_id = ? AND passed = 1`,
      [userId]
    );
    const completedQuestions = completedRows.map(row => row.challenge_id);
    const completedSet = new Set(completedQuestions);

    // 1. Get Active Assignment from DB
    let userAssignment = await ChallengeAssignment.findCurrent(userId, courseId, level || 1);

    // Get all questions for this course (Skill Path Step) from database
    let levelQuestions;
    try {
      levelQuestions = await ChallengeModel.findByCourse(courseId);
    } catch (dbError) {
      console.log('Database error, using JSON file (fallback):', dbError.message);
      const allChallenges = getAllChallenges();
      levelQuestions = allChallenges.filter(c => c.courseId === courseId);
    }

    console.log(`[LevelQuestions] fetching for courseId: ${courseId}, found: ${levelQuestions?.length}`);

    // Ensure we never assign the same challenge twice
    const uniqueLevelQuestions = [];
    const seenIds = new Set();
    for (const question of levelQuestions) {
      if (question?.id && !seenIds.has(question.id)) {
        seenIds.add(question.id);
        uniqueLevelQuestions.push(question);
      }
    }

    if (uniqueLevelQuestions.length === 0) {
      return res.status(404).json({ error: 'No questions found for this level' });
    }

    // Check if assignment is stale (all assigned questions deleted/missing)
    let isStale = false;
    let failedQuestionId = null;

    if (userAssignment) {
      const qId = userAssignment.challenge_id || (userAssignment.assignedQuestions && userAssignment.assignedQuestions[0]);

      const validQuestions = qId ? levelQuestions.filter(lq => lq.id === qId) : [];

      if (validQuestions.length === 0) {
        console.log(`Assignment for ${userId} is stale (questions missing). Re-assigning.`);
        isStale = true;
      } else {
        // Check for FAILED attempts on the assigned question
        try {
          const qId = validQuestions[0].id; // Fix: validQuestions is array of objects, need ID
          console.log(`[LevelQuestions] Checking previous attempts for user ${userId} on question ${qId}`);

          // Get the latest COMPLETED submission (ignore drafts)
          const [latestSubmission] = await query(
            `SELECT passed, status FROM submissions 
             WHERE user_id = ? AND challenge_id = ? AND status != 'saved'
             ORDER BY submitted_at DESC LIMIT 1`,
            [userId, qId]
          );

          if (latestSubmission) {
            console.log(`[LevelQuestions] Latest submission: Status=${latestSubmission.status}, Passed=${latestSubmission.passed} (Type: ${typeof latestSubmission.passed})`);
            // Treat 'queued', 'evaluating', 'pending' as failed/stale to ensure immediate randomization on retest attempts.
            // 'saved' status (drafts) will still be preserved (not stale).
            const isNonPassing = !latestSubmission.passed || latestSubmission.passed === 0;
            const isStaleStatus = ['evaluated', 'failed', 'queued', 'evaluating', 'pending'].includes(latestSubmission.status);

            if (isStaleStatus && isNonPassing) {
              console.log(`User ${userId} has a non-passing submission (Status: ${latestSubmission.status}) for question ${qId}. re-assigning new random question.`);
              isStale = true;
              failedQuestionId = qId;
            }
          } else {
            console.log(`[LevelQuestions] No previous submission found.`);
          }
        } catch (err) {
          console.warn('Failed to check validation status for re-assignment:', err.message);
        }
      }
    }

    // If forceNew=true or no assignment exists OR STALE, create a new random assignment
    if (forceNew === 'true' || !userAssignment || isStale) {
      // Filter out completed questions AND failed question
      let candidateQuestions = uniqueLevelQuestions.filter(q => !completedSet.has(q.id));

      if (failedQuestionId) {
        console.log(`[LevelQuestions] Excluding failed question ${failedQuestionId} from selection pool.`);
        candidateQuestions = candidateQuestions.filter(q => q.id !== failedQuestionId);
      }

      console.log(`[LevelQuestions] Candidate pool size: ${candidateQuestions.length} (Total: ${uniqueLevelQuestions.length}, Completed: ${completedSet.size})`);

      // If no candidates left (all completed or filtered), what to do?
      // If all completed, maybe return empty? Or reset?
      // If we filtered out the ONLY failed question and everything else is completed...
      if (candidateQuestions.length === 0) {
        if (completedSet.size > 0 && uniqueLevelQuestions.every(q => completedSet.has(q.id))) {
          // All questions completed!
          return res.json({
            assignedQuestions: [],
            totalAssigned: 0,
            completedQuestions: completedQuestions,
            isLevelComplete: true,
            message: "All questions completed!"
          });
        }

        // If we just ran out because of failedQuestionId exclusion (and others are complete), fall back to retry failed question.
        // This ensures if there's only one question and it was failed, it's still offered.
        console.log(`[LevelQuestions] No fresh candidates available. Falling back to retry failed question.`);
        candidateQuestions = uniqueLevelQuestions.filter(q => !completedSet.has(q.id)); // Include failed one back if it was the only one
        if (candidateQuestions.length === 0) candidateQuestions = uniqueLevelQuestions; // Final fallback: if all are completed, or if only one exists and it was failed, offer it.
      }

      // Select 1 random question (or all if less than 1)
      const shuffled = [...candidateQuestions].sort(() => 0.5 - Math.random());
      const selectedQuestions = shuffled.slice(0, 1);

      console.log(`[LevelQuestions] Selected new question: ${selectedQuestions[0]?.id}`);

      // Create new assignment in DB
      try {
        const assignedId = await ChallengeAssignment.assign(userId, courseId, parseInt(level) || 1, selectedQuestions[0].id);

        // Re-fetch the new assignment to get the standard format
        userAssignment = {
          id: assignedId,
          userId,
          courseId,
          level: parseInt(level) || 1,
          assignedQuestions: [selectedQuestions[0].id],
          // We will fetch completed questions below
        };
      } catch (err) {
        console.error("Failed to create assignment:", err);
        return res.status(500).json({ error: "Failed to assign question" });
      }
    }

    // Identify the currently assigned question ID
    let assignedQId = null;
    if (userAssignment) {
      if (userAssignment.challenge_id) assignedQId = userAssignment.challenge_id;
      else if (userAssignment.assignedQuestions && userAssignment.assignedQuestions.length > 0) {
        assignedQId = userAssignment.assignedQuestions[0];
      }
    }

    // Get the full question details for assigned questions (Strictly limit to 1)
    // Safety check
    if (!assignedQId) {
      console.warn("Failed to resolve assigned question ID");
      // Fallback: If no assignment, return empty list (or handle error)
      return res.json({
        assignedQuestions: [],
        totalAssigned: 0,
        completedQuestions: [],
        isLevelComplete: false
      });
    }

    const question = levelQuestions.find(c => c.id === assignedQId);

    // Only return if valid
    const assignedFullQuestions = question ? [{
      id: question.id,
      title: question.title,
      description: question.description,
      points: question.points || 0,
      level: question.level
    }] : [];

    console.log(`[LevelQuestions] Final Assigned Questions Count: ${assignedFullQuestions.length}`);

    res.json({
      assignedQuestions: assignedFullQuestions,
      totalAssigned: assignedFullQuestions.length,
      completedQuestions: completedQuestions || [],
      isLevelComplete: false // Logic for level completion can be added here later
    });

  } catch (error) {
    console.error('Error getting level questions:', error);
    res.status(500).json({ error: 'Failed to get level questions' });
  }
});

/**
 * GET /api/challenges/:id
 * Get specific challenge by ID (supports both old and new format)
 */
router.get('/:id', async (req, res) => {
  try {
    let challenge;
    try {
      challenge = await ChallengeModel.findById(req.params.id);
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      const allChallenges = getAllChallenges();
      challenge = allChallenges.find(c => c.id === req.params.id);
    }

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Return full challenge including expected solution (for candidate view and preview)
    res.json({
      ...challenge,
      assets: challenge.assets || { images: [], reference: '' }
    });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

/**
 * GET /api/challenges/:id/solution (Internal use only for evaluation)
 * Get challenge with expected solution (supports both old and new format)
 */
router.get('/:id/solution', (req, res) => {
  try {
    const allChallenges = getAllChallenges();
    const challenge = allChallenges.find(c => c.id === req.params.id);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    res.json(challenge);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch challenge solution' });
  }
});

/**
 * POST /api/challenges
 * Create a new challenge (Admin only)
 */
router.post('/', (req, res) => {
  try {
    const challenges = getChallenges();
    const newChallenge = {
      id: `challenge-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };

    challenges.push(newChallenge);
    saveChallenges(challenges);

    res.status(201).json(newChallenge);
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/**
 * PUT /api/challenges/:id
 * Update an existing challenge (Admin only)
 */
router.put('/:id', (req, res) => {
  try {
    const challenges = getChallenges();
    const index = challenges.findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    challenges[index] = {
      ...challenges[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    };

    saveChallenges(challenges);
    res.json(challenges[index]);
  } catch (error) {
    console.error('Error updating challenge:', error);
    res.status(500).json({ error: 'Failed to update challenge' });
  }
});

/**
 * DELETE /api/challenges/:id
 * Delete a challenge (Admin only)
 */
router.delete('/:id', (req, res) => {
  try {
    const challenges = getChallenges();
    const index = challenges.findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    challenges.splice(index, 1);
    saveChallenges(challenges);

    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    res.status(500).json({ error: 'Failed to delete challenge' });
  }
});

module.exports = router;
