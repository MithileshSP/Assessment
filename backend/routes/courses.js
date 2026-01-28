/**
 * Courses Routes
 * Handles course listings, levels, and progress tracking
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const CourseModel = require('../models/Course');
const ChallengeModel = require('../models/Challenge');
const { query } = require('../database/connection');
const { verifyFaculty } = require('../middleware/auth');

const challengesPath = path.join(__dirname, '../data/challenges-new.json');
const progressPath = path.join(__dirname, '../data/user-progress.json');
const assignmentsPath = path.join(__dirname, '../data/user-assignments.json');
const coursesPath = path.join(__dirname, '../data/courses.json');

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

// Helper to get all courses
const getCourses = () => {
  const courses = loadJSON(coursesPath);
  if (!courses || courses.length === 0) {
    return [
      {
        id: "course-html-css",
        title: "HTML & CSS Mastery",
        description: "Master the fundamentals of web development",
        thumbnail: null,
        icon: "🎨",
        color: "#e34c26",
        totalLevels: 10,
        estimatedTime: "20 hours",
        difficulty: "Beginner",
        difficulty: "Beginner",
        tags: ["HTML", "CSS"],
        isLocked: false,
        isHidden: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "course-fullstack",
        title: "Fullstack Development",
        description: "Become a complete web developer",
        thumbnail: null,
        icon: "💻",
        color: "#3B82F6",
        totalLevels: 12,
        estimatedTime: "40 hours",
        difficulty: "Intermediate",
        tags: ["Node.js", "React", "Database"],
        isLocked: false,
        isHidden: false,
        createdAt: new Date().toISOString()
      }
    ];
  }
  return courses;
};

// Helper to save courses
const saveCourses = (courses) => {
  return saveJSON(coursesPath, courses);
};

// Helper to get all challenges
const getChallenges = () => {
  return loadJSON(challengesPath);
};

// Helper to save challenges
const saveChallenges = (challenges) => {
  return saveJSON(challengesPath, challenges);
};

// Helper to get user progress
const getProgress = () => {
  return loadJSON(progressPath);
};

// Helper to save user progress
const saveProgress = (progress) => {
  return saveJSON(progressPath, progress);
};

// Helper to get user assignments
const getAssignments = () => {
  return loadJSON(assignmentsPath);
};

// Helper to save user assignments
const saveAssignments = (assignments) => {
  return saveJSON(assignmentsPath, assignments);
};

/**
 * GET /api/courses
 * Get all available courses
 */
router.get('/', async (req, res) => {
  try {
    let courses;
    try {
      courses = await CourseModel.findAll();
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      courses = loadJSON(coursesPath);
    }

    // Convert snake_case to camelCase for frontend
    const formattedCourses = courses.map(course => ({
      ...course,
      imageUrl: course.image_url || course.imageUrl,
      totalLevels: course.total_levels || course.totalLevels,
      totalPoints: course.total_points || course.totalPoints,
      estimatedTime: course.estimated_time || course.estimatedTime,
      isLocked: course.is_locked || course.isLocked,
      isHidden: course.is_hidden || course.isHidden,
      createdAt: course.created_at || course.createdAt
    }));

    res.json(formattedCourses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * GET /api/courses/:courseId
 * Get specific course details
 */
router.get('/:courseId', async (req, res) => {
  try {
    let course;
    try {
      course = await CourseModel.findById(req.params.courseId);
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      const courses = loadJSON(coursesPath);
      course = courses.find(c => c.id === req.params.courseId);
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Convert snake_case to camelCase
    const formattedCourse = {
      ...course,
      imageUrl: course.image_url || course.imageUrl,
      totalLevels: course.total_levels || course.totalLevels,
      totalPoints: course.total_points || course.totalPoints,
      estimatedTime: course.estimated_time || course.estimatedTime,
      isLocked: course.is_locked || course.isLocked,
      isHidden: course.is_hidden || course.isHidden,
      createdAt: course.created_at || course.createdAt
    };

    res.json(formattedCourse);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

/**
 * GET /api/courses/:courseId/levels
 * Get all levels for a course
 */
router.get('/:courseId/levels', async (req, res) => {
  try {
    let challenges = [];

    // Try database first
    try {
      challenges = await query(
        'SELECT * FROM challenges WHERE course_id = ? ORDER BY level, id',
        [req.params.courseId]
      );
    } catch (dbError) {
      console.log('Database error, using JSON file for levels:', dbError.message);
      // Fallback to JSON file
      const allChallenges = getChallenges();
      challenges = allChallenges.filter(c => c.courseId === req.params.courseId);
    }

    // Group by level
    const levels = {};
    challenges.forEach(challenge => {
      const levelNum = challenge.level;
      if (!levels[levelNum]) {
        levels[levelNum] = [];
      }
      // Convert snake_case and parse JSON (handle both DB and JSON formats)
      levels[levelNum].push({
        ...challenge,
        courseId: challenge.course_id || challenge.courseId,
        timeLimit: challenge.time_limit || challenge.timeLimit,
        passingThreshold: typeof challenge.passing_threshold === 'string'
          ? JSON.parse(challenge.passing_threshold || '{}')
          : (challenge.passingThreshold || {}),
        expectedSolution: challenge.expected_html ? {
          html: challenge.expected_html,
          css: challenge.expected_css,
          js: challenge.expected_js
        } : (challenge.expectedSolution || {}),
        expectedScreenshotUrl: challenge.expected_screenshot_url || challenge.expectedScreenshotUrl,
        createdAt: challenge.created_at || challenge.createdAt,
        updatedAt: challenge.updated_at || challenge.updatedAt,
        tags: typeof challenge.tags === 'string'
          ? JSON.parse(challenge.tags || '[]')
          : (challenge.tags || [])
      });
    });

    // Convert to array and sort
    const levelsArray = Object.keys(levels).map(level => ({
      level: parseInt(level),
      questions: levels[level],
      totalQuestions: levels[level].length,
      totalPoints: levels[level].reduce((sum, q) => sum + (q.points || 0), 0)
    })).sort((a, b) => a.level - b.level);

    res.json(levelsArray);
  } catch (error) {
    console.error('Error fetching levels:', error);
    res.status(500).json({ error: 'Failed to fetch levels' });
  }
});

/**
 * GET /api/courses/:courseId/levels/:level/questions
 * Get assigned questions for a specific level (2 random questions)
 * Query params: userId (optional, defaults to 'default-user')
 */
router.get('/:courseId/levels/:level/questions', async (req, res) => {
  try {
    const { courseId, level } = req.params;
    const userId = req.query.userId || 'default-user';

    // Get all questions for this level (question bank) from database
    const allQuestions = await ChallengeModel.findByCourseLevel(courseId, parseInt(level));

    if (allQuestions.length === 0) {
      return res.status(404).json({ error: 'No questions found for this level' });
    }

    // Check if user already has assigned questions for this level
    const assignments = getAssignments();
    const assignmentKey = `${userId}-${courseId}-${level}`;
    let userAssignment = assignments.find(a => a.key === assignmentKey);

    if (!userAssignment) {
      // First time user accesses this level - assign 2 random questions
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      const selectedQuestions = shuffled.slice(0, Math.min(2, allQuestions.length));

      userAssignment = {
        key: assignmentKey,
        userId,
        courseId,
        level: parseInt(level),
        assignedQuestions: selectedQuestions.map(q => q.id),
        completedQuestions: [],
        assignedAt: new Date().toISOString(),
        totalAvailable: allQuestions.length
      };

      assignments.push(userAssignment);
      saveAssignments(assignments);

      console.log(`✅ Assigned ${selectedQuestions.length} random questions to ${userId} for ${courseId} Level ${level}`);
    }

    // Return only the assigned questions
    const assignedQuestions = allQuestions.filter(q =>
      userAssignment.assignedQuestions.includes(q.id)
    );

    // Add completion status to each question
    const questionsWithStatus = assignedQuestions.map(q => ({
      ...q,
      isCompleted: userAssignment.completedQuestions.includes(q.id)
    }));

    res.json(questionsWithStatus);
  } catch (error) {
    console.error('Failed to fetch questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * GET /api/courses/:courseId/levels/:level/questions/:questionId
 * Get specific question details
 */
router.get('/:courseId/levels/:level/questions/:questionId', (req, res) => {
  try {
    const challenges = getChallenges();
    const question = challenges.find(c => c.id === req.params.questionId);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({
      ...question,
      assets: (typeof question.assets === 'object' && question.assets !== null)
        ? question.assets
        : JSON.parse(question.assets || '{"images":[],"reference":""}')
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

router.get('/progress/:userId', async (req, res) => {
  try {
    try {

      // Actually, the route is generic /progress/:userId, so we should fetch ALL courses for this user
      const allDbProgress = await query(
        `SELECT course_id, current_level, completed_levels, total_points 
         FROM user_progress 
         WHERE user_id = ?`,
        [req.params.userId]
      );

      if (allDbProgress.length > 0) {
        const courses = allDbProgress.map(row => {
          let levels = [];
          try {
            // Handle both JSON string and actual array (if driver parses it)
            levels = typeof row.completed_levels === 'string'
              ? JSON.parse(row.completed_levels)
              : (row.completed_levels || []);
            if (!Array.isArray(levels)) levels = [];
          } catch (e) { levels = []; }

          return {
            courseId: row.course_id,
            currentLevel: row.current_level || 1,
            completedLevels: levels,
            totalPoints: row.total_points || 0
          };
        });

        return res.json({
          userId: req.params.userId,
          courses,
          totalPoints: courses.reduce((sum, c) => sum + c.totalPoints, 0),
          achievements: [] // DB doesn't track achievements yet
        });
      }
    } catch (dbErr) {
      console.error('Database progress fetch failed:', dbErr.message);
    }

    // 2. Fallback to JSON file
    console.log('[DEBUG] GET /progress/', req.params.userId);
    let allProgress = getProgress();
    console.log('[DEBUG] Total progress entries:', allProgress.length);
    let userProgress = allProgress.find(p => p.userId === req.params.userId);

    // If no progress file entry, try to infer from completed test sessions
    if (!userProgress) {
      try {
        const rows = await query(
          `SELECT course_id, level, overall_status, passed_count, total_questions
           FROM test_sessions
           WHERE user_id = ?`,
          [req.params.userId]
        );

        const completed = rows.filter(r => r.overall_status === 'passed' || (r.total_questions > 0 && r.passed_count === r.total_questions));
        const coursesMap = new Map();

        completed.forEach((r) => {
          const courseId = r.course_id;
          if (!coursesMap.has(courseId)) {
            coursesMap.set(courseId, {
              courseId,
              completedLevels: [],
              currentLevel: 1,
              totalPoints: 0,
            });
          }
          const course = coursesMap.get(courseId);
          const lvl = parseInt(r.level);
          if (!course.completedLevels.includes(lvl)) {
            course.completedLevels.push(lvl);
          }
          course.currentLevel = Math.max(course.currentLevel, lvl + 1);
        });

        const inferredCourses = Array.from(coursesMap.values()).map(c => ({
          ...c,
          completedLevels: c.completedLevels.sort((a, b) => a - b),
        }));

        if (inferredCourses.length > 0) {
          userProgress = {
            userId: req.params.userId,
            courses: inferredCourses,
            totalPoints: 0,
            achievements: [],
          };

          // OPTIONAL: Do not write back to JSON to avoid conflicts, just return inferred
          // But original code wrote back. We keep it for now.
          allProgress.push(userProgress);
          saveProgress(allProgress);
        }
      } catch (inferErr) {
        console.error('Failed to infer progress from test sessions:', inferErr.message);
      }
    }

    if (!userProgress) {
      return res.json({
        userId: req.params.userId,
        courses: [],
        totalPoints: 0,
        achievements: []
      });
    }

    res.json(userProgress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/**
 * POST /api/courses/progress/:userId/complete
 * Mark a question as completed and check if level is unlocked
 * Body: { questionId, courseId, level, score }
 */
router.post('/progress/:userId/complete', (req, res) => {
  try {
    const { userId } = req.params;
    const { questionId, courseId, level, score } = req.body;

    if (!questionId || !courseId || !level) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update assignment to mark question as completed
    const assignments = getAssignments();
    const assignmentKey = `${userId}-${courseId}-${level}`;
    const assignmentIndex = assignments.findIndex(a => a.key === assignmentKey);

    if (assignmentIndex === -1) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignments[assignmentIndex];

    // Add to completed questions if not already there
    if (!assignment.completedQuestions.includes(questionId)) {
      assignment.completedQuestions.push(questionId);
      assignment.lastCompletedAt = new Date().toISOString();
    }

    // Check if level is complete (all assigned questions done)
    const levelComplete = assignment.completedQuestions.length === assignment.assignedQuestions.length;
    assignment.isLevelComplete = levelComplete;

    if (levelComplete) {
      assignment.completedAt = new Date().toISOString();
      console.log(`🎉 ${userId} completed ${courseId} Level ${level}!`);
    }

    assignments[assignmentIndex] = assignment;
    saveAssignments(assignments);

    // Update user progress
    const allProgress = getProgress();
    let userProgressIndex = allProgress.findIndex(p => p.userId === userId);

    if (userProgressIndex === -1) {
      // Create new progress entry
      allProgress.push({
        userId,
        courses: [],
        totalPoints: 0,
        achievements: []
      });
      userProgressIndex = allProgress.length - 1;
    }

    const userProgress = allProgress[userProgressIndex];

    // Find or create course progress
    let courseProgress = userProgress.courses.find(c => c.courseId === courseId);
    if (!courseProgress) {
      courseProgress = {
        courseId,
        completedLevels: [],
        currentLevel: 1,
        totalPoints: 0
      };
      userProgress.courses.push(courseProgress);
    }

    // Update points
    const question = getChallenges().find(q => q.id === questionId);
    const points = score || question?.points || 100;
    courseProgress.totalPoints += points;
    userProgress.totalPoints += points;

    // Mark level as complete and unlock next level
    if (levelComplete && !courseProgress.completedLevels.includes(parseInt(level))) {
      courseProgress.completedLevels.push(parseInt(level));
      courseProgress.currentLevel = Math.min(parseInt(level) + 1, 6); // Max 6 levels

      console.log(`🔓 Unlocked Level ${courseProgress.currentLevel} for ${userId}`);
    }

    allProgress[userProgressIndex] = userProgress;
    saveProgress(allProgress);

    res.json({
      message: 'Progress updated',
      levelComplete,
      nextLevelUnlocked: levelComplete,
      nextLevel: levelComplete ? Math.min(parseInt(level) + 1, 6) : parseInt(level),
      completedQuestions: assignment.completedQuestions.length,
      totalQuestions: assignment.assignedQuestions.length,
      points,
      totalPoints: courseProgress.totalPoints
    });
  } catch (error) {
    console.error('Progress update error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Mark an entire level as completed (without needing assignment context)
router.post('/progress/:userId/level-complete', (req, res) => {
  try {
    const { userId } = req.params;
    const { courseId, level, passed } = req.body;

    if (!courseId || !level) {
      return res.status(400).json({ error: 'Missing courseId or level' });
    }

    // If explicitly failed, do not mark as complete
    if (passed === false) {
      return res.json({
        message: 'Level attempt recorded (not passed)',
        courseProgress: null // No progress update
      });
    }

    const allProgress = getProgress();
    let userProgress = allProgress.find((p) => p.userId === userId);

    if (!userProgress) {
      userProgress = { userId, courses: [], totalPoints: 0, achievements: [] };
      allProgress.push(userProgress);
    }

    let courseProgress = userProgress.courses.find((c) => c.courseId === courseId);
    if (!courseProgress) {
      courseProgress = {
        courseId,
        completedLevels: [],
        currentLevel: 1,
        totalPoints: 0,
      };
      userProgress.courses.push(courseProgress);
    }

    const numericLevel = parseInt(level);
    if (!courseProgress.completedLevels.includes(numericLevel)) {
      courseProgress.completedLevels.push(numericLevel);
      courseProgress.completedLevels.sort((a, b) => a - b);
    }

    courseProgress.currentLevel = Math.max(courseProgress.currentLevel || 1, numericLevel + 1);

    saveProgress(allProgress);

    res.json({
      message: 'Level marked complete',
      courseProgress,
    });
  } catch (error) {
    console.error('Level complete progress error:', error);
    res.status(500).json({ error: 'Failed to mark level complete' });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * PUT /api/courses/:courseId
 * Update a course (Admin only)
 */
router.put('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const updatedCourse = req.body;

    // 1. Update in Database
    let dbUpdated = null;
    try {
      dbUpdated = await CourseModel.update(courseId, updatedCourse);
    } catch (dbError) {
      console.log('Database update failed:', dbError.message);
    }

    // 2. Update in JSON file (Legacy/Backup)
    const courses = getCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);

    if (courseIndex === -1 && !dbUpdated) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (courseIndex !== -1) {
      // Update course while keeping the ID
      courses[courseIndex] = { ...courses[courseIndex], ...updatedCourse, id: courseId };
      // Save to file
      fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2));
    }

    res.json({
      message: 'Course updated successfully',
      course: dbUpdated || courses[courseIndex]
    });
  } catch (error) {
    console.error('Course update error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

/**
 * POST /api/courses
 * Create a new course (Admin only)
 */
router.post('/', async (req, res) => {
  try {
    const courseData = req.body;

    // Validate required fields
    if (!courseData.title) {
      return res.status(400).json({ error: 'Course title is required' });
    }

    const Course = require('../models/Course');
    const newCourse = await Course.create(courseData);

    res.status(201).json({
      message: 'Course created successfully',
      course: newCourse
    });
  } catch (error) {
    console.error('Course creation error:', error);
    res.status(500).json({ error: 'Failed to create course: ' + error.message });
  }
});

/**
 * DELETE /api/courses/:courseId
 * Delete a course (Admin only)
 */
router.delete('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    // 1. Delete from Database
    try {
      await CourseModel.delete(courseId);
    } catch (dbError) {
      console.log('Database delete failed:', dbError.message);
    }

    // 2. Delete from JSON file
    const courses = getCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);

    let deletedCourse = null;
    if (courseIndex !== -1) {
      deletedCourse = courses[courseIndex];
      courses.splice(courseIndex, 1);
      // Save to file
      fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2));
    }

    if (courseIndex === -1) {
      // If not in JSON, check if we at least tried to delete from DB
      // We assume if it didn't throw in DB delete, it might have existed or we just ignore 404 for idempotency
      // But to be consistent with previous behavior, if we didn't find it anywhere, return 404
      // ideally check rows affected, but CourseModel.delete might not return that.
    }

    res.json({
      message: 'Course deleted successfully',
      course: deletedCourse || { id: courseId }
    });
  } catch (error) {
    console.error('Course deletion error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

/**
 * GET /api/courses/:courseId/questions
 * Get all questions for a specific course (Admin view)
 */
router.get('/:courseId/questions', async (req, res) => {
  try {
    const { courseId } = req.params;
    let courseQuestions;

    try {
      // Query challenges from database by course_id with creator names
      courseQuestions = await ChallengeModel.findByCourse(courseId);
    } catch (dbError) {
      console.log('Database error, using JSON file:', dbError.message);
      const challenges = getChallenges();
      courseQuestions = challenges.filter(c => c.courseId === courseId);
    }

    // Debug output for assets
    if (courseQuestions && courseQuestions.length > 0) {
      console.log(`[DEBUG] GET /courses/${courseId}/questions returning ${courseQuestions.length} items`);
      const sample = courseQuestions.find(q => q.assets && (q.assets.images?.length > 0 || Array.isArray(q.assets)));
      if (sample) {
        console.log(`[DEBUG] Sample question ${sample.id} assets:`, JSON.stringify(sample.assets));
      } else {
        console.log(`[DEBUG] No questions with assets found`);
      }
    }

    res.json(courseQuestions);
  } catch (error) {
    console.error('Error fetching course questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Update a question (Admin or Faculty only)
router.put('/questions/:questionId', verifyFaculty, async (req, res) => {
  try {
    const { questionId } = req.params;
    const updatedQuestion = req.body;
    console.log(`[DEBUG] PUT Question ${questionId} - Assets payload:`, JSON.stringify(updatedQuestion.assets || 'NO ASSETS'));

    let updatedDbQuestion = null;

    // 1. Update in Database
    try {
      updatedDbQuestion = await ChallengeModel.update(questionId, updatedQuestion);
    } catch (dbError) {
      console.error('Database update failed:', dbError.message);
    }

    // 2. Update in JSON File (Legacy/Backup)
    const challenges = getChallenges();
    const questionIndex = challenges.findIndex(c => c.id === questionId);

    if (questionIndex !== -1) {
      // Update question while keeping the ID
      challenges[questionIndex] = { ...challenges[questionIndex], ...updatedQuestion, id: questionId };
      // Update timestamp
      challenges[questionIndex].updatedAt = new Date().toISOString();
      // Save to file
      fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));
    } else if (!updatedDbQuestion) {
      // If not in DB AND not in JSON, then it's a 404
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({
      message: 'Question updated successfully',
      question: updatedDbQuestion || challenges[questionIndex]
    });
  } catch (error) {
    console.error('Question update error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Create a new question for a course (Admin or Faculty only)
router.post('/:courseId/questions', verifyFaculty, async (req, res) => {
  try {
    const { courseId } = req.params;
    const newQuestion = req.body;
    const createdBy = req.user.id;

    // Validate required fields
    if (!newQuestion.id || !newQuestion.title || !newQuestion.level) {
      return res.status(400).json({ error: 'Question ID, title, and level are required' });
    }

    const challenges = getChallenges();

    // Check if question ID already exists
    if (challenges.find(c => c.id === newQuestion.id)) {
      return res.status(400).json({ error: 'Question ID already exists' });
    }

    // Add default values
    const question = {
      questionNumber: 1,
      points: 100,
      isLocked: false,
      hints: [],
      assets: { images: [], reference: '' },
      ...newQuestion,
      courseId: courseId, // Ensure courseId from params is used
      createdBy: createdBy, // Ensure createdBy from auth is used
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(`[Routes] Creating question for course ${courseId}, user: ${createdBy}`);

    // 1. Save to Database
    try {
      await ChallengeModel.create(question);
    } catch (dbError) {
      console.error('Database create failed:', dbError.message);
      // If DB is crucial, we should probably return an error here
      return res.status(500).json({ error: 'Database creation failed: ' + dbError.message });
    }

    // 2. Save to JSON File (Legacy/Backup)
    challenges.push(question);
    fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));

    res.status(201).json({
      message: 'Question created successfully',
      question
    });
  } catch (error) {
    console.error('Question creation error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

/**
 * DELETE /api/courses/questions/:questionId
 * Delete a question (Admin or Faculty only)
 */
router.delete('/questions/:questionId', verifyFaculty, async (req, res) => {
  try {
    const { questionId } = req.params;

    // Delete from database
    await ChallengeModel.delete(questionId);

    // Also remove from JSON file backup/cache
    const challenges = getChallenges();
    const questionIndex = challenges.findIndex(c => c.id === questionId);

    let deletedQuestion = null;
    if (questionIndex !== -1) {
      deletedQuestion = challenges[questionIndex];
      challenges.splice(questionIndex, 1);
      // Save to file
      fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));
    }

    res.json({
      message: 'Question deleted successfully',
      question: deletedQuestion
    });
  } catch (error) {
    console.error('Question deletion error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

/**
 * POST /api/courses/:courseId/questions/bulk
 * Bulk upload questions from JSON/CSV
 * Body: { questions: [...] }
 */
router.post('/:courseId/questions/bulk', verifyFaculty, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions array required' });
    }

    // Validate course exists
    let course;
    try {
      course = await CourseModel.findById(courseId);
    } catch (e) {
      const courses = getCourses();
      course = courses.find(c => c.id === courseId);
    }
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        // Flexible field mapping - handle different CSV column names
        const title = question.title || question.Title || question.TITLE;
        const description = question.description || question.Description || question.DESCRIPTION || '';
        const instructions = question.instructions || question.Instructions || question.INSTRUCTIONS || '';
        const level = parseInt(question.level || question.Level || question.LEVEL || 1);
        const courseIdField = question.courseId || question.course_id || courseId; // Use field if provided, else path param

        // Validate required fields
        if (!title) {
          errors.push(`Question ${i + 1}: Missing required field 'title'`);
          skippedCount++;
          continue;
        }

        // Auto-generate ID if not provided
        const id = question.id || question.Id || `q-${courseIdField}-${level}-${Date.now()}-${i}`;

        // Handle Tags (pipe separated or array)
        let tags = [];
        if (question.tags) {
          if (Array.isArray(question.tags)) {
            tags = question.tags;
          } else if (typeof question.tags === 'string') {
            tags = question.tags.split('|').map(t => t.trim()).filter(t => t);
          }
        }

        // Handle Assets (pipe separated or object)
        let assets = { images: [], reference: '' };
        if (question.assets) {
          if (typeof question.assets === 'string') {
            const paths = question.assets.split('|').map(p => p.trim()).filter(p => p);
            assets.images = paths.map(p => ({
              name: p.split('/').pop(),
              path: p,
              description: 'Imported asset'
            }));
          } else if (typeof question.assets === 'object') {
            assets = question.assets;
          }
        }

        // Build question data (removing legacy difficulty/timeLimit)
        const questionData = {
          id,
          title,
          description,
          instructions,
          level,
          courseId: courseIdField,
          tags,
          assets,
          passingThreshold: question.passingThreshold || { structure: 80, visual: 80, overall: 75 },
          expectedHtml: question.expectedHtml || question.expected_html || question['expectedSolution/html'] || '',
          expectedCss: question.expectedCss || question.expected_css || question['expectedSolution/css'] || '',
          expectedJs: question.expectedJs || question.expected_js || question['expectedSolution/js'] || '',
          createdBy: req.user.id // Attribution for bulk upload
        };

        // Create in MySQL using ChallengeModel
        await ChallengeModel.create(questionData);

        addedCount++;
      } catch (err) {
        console.error(`Bulk import question ${i + 1} error:`, err.message);
        errors.push(`Question ${i + 1}: ${err.message}`);
        skippedCount++;
      }
    }

    // Also update JSON file for legacy sync
    if (addedCount > 0) {
      try {
        const challenges = getChallenges();
        const newQuestions = questions.slice(0, addedCount).map((q, i) => ({
          id: q.id || `q-${courseId}-${q.level || 1}-${Date.now()}-${i}`,
          courseId,
          ...q
        }));
        challenges.push(...newQuestions);
        fs.writeFileSync(challengesPath, JSON.stringify(challenges, null, 2));
      } catch (e) {
        console.warn('JSON sync failed:', e.message);
      }
    }

    console.log(`Bulk import: ${addedCount} added, ${skippedCount} skipped for course ${courseId}`);

    res.json({
      message: 'Bulk upload completed',
      added: addedCount,
      skipped: skippedCount,
      total: questions.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to upload questions: ' + error.message });
  }
});

/**
 * POST /api/courses/:courseId/questions/bulk-delete
 * Bulk delete questions
 * Body: { questionIds: [...] }
 */
router.post('/:courseId/questions/bulk-delete', verifyFaculty, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { questionIds } = req.body;

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'questionIds array required' });
    }

    let deletedCount = 0;
    const errors = [];

    // Delete from MySQL
    for (const questionId of questionIds) {
      try {
        await query('DELETE FROM challenges WHERE id = ? AND course_id = ?', [questionId, courseId]);
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete question ${questionId}:`, err.message);
        errors.push(`${questionId}: ${err.message}`);
      }
    }

    // Also update JSON file for legacy sync
    try {
      const challenges = getChallenges();
      const filteredChallenges = challenges.filter(c => !questionIds.includes(c.id));
      if (filteredChallenges.length < challenges.length) {
        fs.writeFileSync(challengesPath, JSON.stringify(filteredChallenges, null, 2));
      }
    } catch (e) {
      console.warn('JSON sync failed:', e.message);
    }

    console.log(`Bulk delete: ${deletedCount} deleted from course ${courseId}`);

    res.json({
      message: 'Bulk delete completed',
      deleted: deletedCount,
      total: questionIds.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete questions: ' + error.message });
  }
});

/**
 * GET /api/courses/:courseId/levels/:level/randomize
 * Get random questions for a level (question bank feature)
 * Query params: count (default: 2)
 */
router.get('/:courseId/levels/:level/randomize', (req, res) => {
  try {
    const { courseId, level } = req.params;
    const count = parseInt(req.query.count) || 2;

    const challenges = getChallenges();
    const levelQuestions = challenges.filter(
      c => c.courseId === courseId && c.level === parseInt(level)
    );

    if (levelQuestions.length === 0) {
      return res.json([]);
    }

    // Shuffle and pick random questions
    const shuffled = [...levelQuestions].sort(() => 0.5 - Math.random());
    const randomQuestions = shuffled.slice(0, Math.min(count, levelQuestions.length));

    res.json({
      questions: randomQuestions,
      totalAvailable: levelQuestions.length,
      selected: randomQuestions.length
    });
  } catch (error) {
    console.error('Randomize error:', error);
    res.status(500).json({ error: 'Failed to randomize questions' });
  }
});

/**
 * GET /api/courses/sample/json
 * Download sample JSON template for bulk upload
 */
router.get('/sample/json', (req, res) => {
  const sampleQuestions = [
    {
      id: "course-id-l1-q1",
      courseId: "course-html-css",
      level: 1,
      questionNumber: 1,
      title: "Sample Question Title",
      description: "Brief description of what students need to build",
      instructions: "Detailed step-by-step instructions:\n- Step 1\n- Step 2\n- Step 3",
      assets: {
        images: [
          {
            name: "sample-image.png",
            path: "/assets/images/sample-image.png",
            description: "Description of the image"
          }
        ],
        reference: "/assets/references/course-id-l1-q1-ref.png"
      },
      hints: [
        "Hint 1: Use semantic HTML",
        "Hint 2: Apply CSS flexbox",
        "Hint 3: Add hover effects"
      ],
      tags: ["HTML", "CSS", "Flexbox"],
      timeLimit: 15,
      points: 100,
      passingThreshold: {
        structure: 70,
        visual: 80,
        overall: 75
      },
      isLocked: false,
      prerequisite: null,
      expectedSolution: {
        html: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Sample</title>\n</head>\n<body>\n  <div class=\"container\">Sample content</div>\n</body>\n</html>",
        css: "body {\n  margin: 0;\n  padding: 20px;\n  font-family: Arial, sans-serif;\n}\n\n.container {\n  max-width: 800px;\n  margin: 0 auto;\n}",
        js: "// Optional JavaScript code"
      }
    },
    {
      id: "course-id-l1-q2",
      courseId: "course-html-css",
      level: 1,
      questionNumber: 2,
      title: "Another Sample Question",
      description: "Second example",
      instructions: "Build something similar to the first question",
      assets: {
        images: [],
        reference: ""
      },
      hints: ["Use what you learned in Q1"],
      tags: ["HTML", "CSS"],
      timeLimit: 20,
      points: 150,
      passingThreshold: {
        structure: 70,
        visual: 80,
        overall: 75
      },
      isLocked: false,
      prerequisite: "course-id-l1-q1",
      expectedSolution: {
        html: "<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>",
        css: "h1 { color: blue; }",
        js: ""
      }
    }
  ];

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=sample-questions.json');
  res.json(sampleQuestions);
});

/**
 * GET /api/courses/sample/csv
 * Download sample CSV template for bulk upload
 */
router.get('/sample/csv', (req, res) => {
  try {
    const { courseId, level } = req.query;

    // Simplified flat schema - only essential fields
    const headers = [
      'courseId',
      'level',
      'title',
      'description',
      'instructions',
      'tags',
      'assets',
      'expectedHtml',
      'expectedCss',
      'expectedJs'
    ];

    // Smart ID generation
    const cId = courseId || 'fullstack';
    const lId = level || '1';
    const qCount = 2; // Generate 2 sample rows

    const rows = [];

    for (let i = 1; i <= qCount; i++) {
      rows.push([
        cId,
        lId,
        `Level ${lId} Question ${i}: Build a Modern Landing Page`,
        `Create a clean, responsive hero section with a navigation bar and CTA button.`,
        `1. Use semantic HTML5 elements.\n2. Ensure the layout is responsive.\n3. Add smooth transitions.`,
        'HTML|CSS|Flexbox|Responsive',
        '/assets/images/logo.png|/assets/images/hero-bg.jpg',
        `<!DOCTYPE html>
<html>
<head>
  <style>
    .hero { background: #f8fafc; padding: 60px; text-align: center; }
    .cta { padding: 12px 24px; background: #6366f1; color: white; border: none; border-radius: 8px; }
  </style>
</head>
<body>
  <nav>Logo</nav>
  <div class="hero">
    <h1>Transform Your Workflow</h1>
    <button class="cta">Get Started</button>
  </div>
</body>
</html>`,
        `.hero { padding: 80px; } .cta { cursor: pointer; }`,
        ''
      ]);
    }

    // Helper to quote string if needed
    const quote = (str) => {
      if (str === null || str === undefined) return '';
      const stringField = String(str);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\t')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const csvContent =
      headers.join(',') + '\n' +
      rows.map(row => row.map(quote).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=questions-template-level-${lId}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV Template download error:', error);
    res.status(500).json({ error: 'Failed to download CSV template' });
  }
});



/**
 * GET /api/courses/:courseId/levels/:level/template
 * Download question bank template for a specific level
 */
router.get('/:courseId/levels/:level/template', (req, res) => {
  const { courseId, level } = req.params;

  const sampleQuestions = [
    {
      id: `${courseId}-l${level}-q1`,
      courseId: courseId,
      level: parseInt(level),
      questionNumber: 1,
      title: `Level ${level} - Question 1`,
      description: "Brief description of what students need to build",
      instructions: "Detailed step-by-step instructions:\n- Step 1: Create HTML structure\n- Step 2: Apply CSS styling\n- Step 3: Add interactivity",
      assets: {
        images: [],
        reference: ""
      },
      hints: [
        "Hint 1: Use semantic HTML tags",
        "Hint 2: Apply modern CSS techniques",
        "Hint 3: Test in browser"
      ],
      tags: ["HTML", "CSS"],
      timeLimit: 20,
      points: 100,
      passingThreshold: {
        structure: 70,
        visual: 80,
        overall: 75
      },
      isLocked: false,
      prerequisite: null,
      expectedSolution: {
        html: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Solution</title>\n</head>\n<body>\n  <div class=\"container\">\n    <!-- Your solution here -->\n  </div>\n</body>\n</html>",
        css: "body {\n  margin: 0;\n  padding: 20px;\n  font-family: Arial, sans-serif;\n}\n\n.container {\n  max-width: 800px;\n  margin: 0 auto;\n}",
        js: "// Optional JavaScript"
      }
    },
    {
      id: `${courseId}-l${level}-q2`,
      courseId: courseId,
      level: parseInt(level),
      questionNumber: 2,
      title: `Level ${level} - Question 2`,
      description: "Another question for this level",
      instructions: "Build something based on the requirements",
      assets: {
        images: [],
        reference: ""
      },
      hints: ["Apply what you learned in Q1"],
      tags: ["HTML", "CSS"],
      timeLimit: 25,
      points: 120,
      passingThreshold: {
        structure: 70,
        visual: 80,
        overall: 75
      },
      isLocked: false,
      prerequisite: `${courseId}-l${level}-q1`,
      expectedSolution: {
        html: "<!DOCTYPE html>\n<html>\n<body>\n  <h1>Question 2</h1>\n</body>\n</html>",
        css: "h1 { color: #333; }",
        js: ""
      }
    }
  ];

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=${courseId}-level-${level}-template.json`);
  res.json(sampleQuestions);
});

/**
 * POST /api/courses/:courseId/levels/:level/questions/bulk
 * Upload question bank for a specific level
 * Body: { questions: [...], randomizeCount: 2 }
 */
router.post('/:courseId/levels/:level/questions/bulk', verifyFaculty, async (req, res) => {
  try {
    const { courseId, level } = req.params;
    const { questions, randomizeCount } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions array required' });
    }

    // Validate course exists
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) {
      console.warn(`[Bulk Upload] Course not found: ${courseId}`);
      return res.status(404).json({ error: 'Course not found' });
    }

    console.log(`[Bulk Upload] Processing ${questions.length} questions for ${courseId} Level ${level}`);
    console.log(`[Bulk Upload] First question sample:`, JSON.stringify(questions[0]));

    // Store randomize count in course level settings
    if (!course.levelSettings) {
      course.levelSettings = {};
    }
    if (!course.levelSettings[level]) {
      course.levelSettings[level] = {};
    }
    course.levelSettings[level].randomizeCount = randomizeCount || 2;

    const challenges = getChallenges();
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Use for...of loop to handle async/await
    for (const [index, question] of questions.entries()) {
      try {
        // Validate required fields
        if (!question.id || !question.title) {
          console.warn(`[Bulk Upload] Skipping Q${index}: Missing id/title`, question);
          errors.push(`Question ${index + 1}: Missing required fields (id, title)`);
          skippedCount++;
          continue;
        }

        // Force the level to match the URL parameter
        const questionData = {
          ...question,
          courseId: courseId,
          level: parseInt(level),
          createdAt: question.createdAt || new Date(),
          updatedAt: new Date()
        };

        // 1. Update/Create in Database
        let dbResult = null;
        try {
          // Check if exists in DB first (to decide whether to update or create)
          // Note: create() handles ID collision by erroring usually, but our model doesn't seem to have upsert. 
          // We will try update first, if null/error, try create.
          const existing = await ChallengeModel.findById(questionData.id);

          if (existing) {
            await ChallengeModel.update(questionData.id, questionData);
            updatedCount++;
          } else {
            await ChallengeModel.create(questionData);
            addedCount++;
          }
        } catch (dbErr) {
          console.error(`[Bulk Upload] DB Error Q${index} (${questionData.id}):`, dbErr.message);
          // If DB fails, we still try to update JSON for legacy support, or we should treat it as error?
          // Let's treat it as error to ensure consistency.
          throw dbErr;
        }

        // 2. Update/Create in JSON File (Legacy/Backup)
        const existingIndex = challenges.findIndex(c => c.id === question.id);
        if (existingIndex !== -1) {
          // Update existing question
          challenges[existingIndex] = { ...challenges[existingIndex], ...questionData, updatedAt: new Date().toISOString() };
        } else {
          // Add new question
          challenges.push({ ...questionData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }

      } catch (err) {
        console.error(`[Bulk Upload] Error processing Q${index}:`, err);
        errors.push(`Question ${index + 1}: ${err.message}`);
        skippedCount++;
        // If we counted it as added/updated before error, we ideally rollback, but simple decrement for now 
        // (though if DB succeeded but JSON failed, we are in inconsistent state. Priority is DB).
      }
    }

    console.log(`[Bulk Upload] Complete. Added: ${addedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // Save challenges
    if (addedCount > 0 || updatedCount > 0) {
      saveChallenges(challenges);

      // Save course with updated level settings
      const courseIndex = courses.findIndex(c => c.id === courseId);
      courses[courseIndex] = course;
      saveCourses(courses);
    }

    res.json({
      message: 'Question bank uploaded successfully',
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: questions.length,
      randomizeCount: course.levelSettings[level].randomizeCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Level bulk upload error:', error);
    res.status(500).json({ error: 'Failed to upload question bank' });
  }
});

/**
 * PUT /api/courses/:courseId/restrictions
 * Update exam restrictions for a course
 */
router.put('/:courseId/restrictions', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { blockCopy, blockPaste, forceFullscreen, maxViolations, timeLimit } = req.body;

    const newRestrictions = {
      blockCopy: blockCopy !== undefined ? blockCopy : true,
      blockPaste: blockPaste !== undefined ? blockPaste : true,
      forceFullscreen: forceFullscreen !== undefined ? forceFullscreen : true,
      maxViolations: maxViolations || 3,
      timeLimit: timeLimit !== undefined ? timeLimit : 0
    };

    // 1. Try Database
    try {
      const course = await CourseModel.findById(courseId);
      if (course) {
        await query(
          "UPDATE courses SET restrictions = ? WHERE id = ?",
          [JSON.stringify(newRestrictions), courseId]
        );
        return res.json({
          message: 'Restrictions updated successfully (DB)',
          restrictions: newRestrictions
        });
      }
    } catch (dbError) {
      console.warn('Database restrictions update failed, falling back to JSON:', dbError.message);
    }

    // 2. Fallback to JSON
    const courses = getCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);

    if (courseIndex === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    courses[courseIndex].restrictions = newRestrictions;
    fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2));

    res.json({
      message: 'Restrictions updated successfully (JSON)',
      restrictions: newRestrictions
    });
  } catch (error) {
    console.error('Restrictions update error:', error);
    res.status(500).json({ error: 'Failed to update restrictions' });
  }
});

/**
 * GET /api/courses/:courseId/restrictions
 * Get exam restrictions for a course
 */
router.get('/:courseId/restrictions', async (req, res) => {
  try {
    const { courseId } = req.params;
    let restrictions = null;

    // 1. Try Database
    try {
      const course = await CourseModel.findById(courseId);
      if (course) {
        restrictions = course.restrictions;
      }
    } catch (dbError) {
      console.warn('Database restrictions fetch failed, falling back to JSON:', dbError.message);
    }

    // 2. Try JSON Fallback
    if (!restrictions) {
      const courses = getCourses();
      const course = courses.find(c => c.id === courseId);
      if (course) {
        restrictions = course.restrictions;
      }
    }

    if (!restrictions && courseId !== 'course-javascript') {
      // If still not found, return 404
      // Note: We might want a default even if course is not found, but 404 is safer for routing
    }

    // Return restrictions with secure defaults enforced
    const secureRestrictions = {
      blockCopy: (restrictions && restrictions.blockCopy !== undefined) ? restrictions.blockCopy : true,
      blockPaste: (restrictions && restrictions.blockPaste !== undefined) ? restrictions.blockPaste : true,
      forceFullscreen: (restrictions && restrictions.forceFullscreen !== undefined) ? restrictions.forceFullscreen : true,
      maxViolations: (restrictions && restrictions.maxViolations) || 3,
      timeLimit: (restrictions && restrictions.timeLimit) || 0
    };

    res.json(secureRestrictions);
  } catch (error) {
    console.error('Get restrictions error:', error);
    res.status(500).json({ error: 'Failed to fetch restrictions' });
  }
});

/**
 * GET /api/courses/:courseId/level-settings
 * Get level settings (randomization counts, etc.)
 */
router.get('/:courseId/level-settings', async (req, res) => {
  try {
    const { courseId } = req.params;
    let levelSettings = null;

    // 1. Try Database
    try {
      const course = await CourseModel.findById(courseId);
      if (course) {
        levelSettings = course.levelSettings || course.level_settings;
      }
    } catch (dbError) {
      console.warn('Database level-settings fetch failed, falling back to JSON:', dbError.message);
    }

    // 2. Try JSON Fallback
    if (!levelSettings) {
      const courses = getCourses();
      const course = courses.find(c => c.id === courseId);
      if (course) {
        levelSettings = course.levelSettings || {};
      }
    }

    res.json(levelSettings || {});
  } catch (error) {
    console.error('Get level settings error:', error);
    res.status(500).json({ error: 'Failed to fetch level settings' });
  }
});

module.exports = router;

