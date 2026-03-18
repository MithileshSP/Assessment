const express = require('express');
const router = express.Router();
const TestSession = require('../models/TestSession');

const { redisConnection } = require('../services/aiQueueService');

// Create a new test session
router.post('/', async (req, res) => {
  try {
    const { user_id, course_id, level } = req.body;

    if (!user_id || !course_id) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, course_id'
      });
    }

    const session = await TestSession.create({
      user_id,
      course_id,
      level: level || 1
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating test session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get test session by ID with Caching
router.get('/:id', async (req, res) => {
  try {
    const CACHE_KEY = `session:${req.params.id}`;
    
    // 1. Try Cache
    try {
        const cached = await redisConnection.get(CACHE_KEY);
        if (cached) return res.json(JSON.parse(cached));
    } catch (e) {}

    // 2. Fetch DB
    const session = await TestSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Test session not found' });
    }

    // 3. Store Cache (10 min)
    try {
        await redisConnection.setex(CACHE_KEY, 600, JSON.stringify(session));
    } catch (e) {}

    res.json(session);
  } catch (error) {
    console.error('Error fetching test session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a submission to test session (INVALIDATE CACHE)
router.post('/:id/submissions', async (req, res) => {
  try {
    const { submission_id } = req.body;

    if (!submission_id) {
      return res.status(400).json({ error: 'Missing submission_id' });
    }

    const session = await TestSession.addSubmission(req.params.id, submission_id);
    
    // Invalidate Cache
    try {
        await redisConnection.del(`session:${req.params.id}`);
    } catch (e) {}

    res.json(session);
  } catch (error) {
    console.error('Error adding submission to session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete test session (INVALIDATE CACHE)
router.put('/:id/complete', async (req, res) => {
  try {
    const { user_feedback } = req.body;

    const session = await TestSession.complete(req.params.id, {
      user_feedback
    });

    // Invalidate Cache
    try {
        await redisConnection.del(`session:${req.params.id}`);
    } catch (e) {}

    res.json(session);
  } catch (error) {
    console.error('Error completing test session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ... (Other routes like findByUserId can also be cached if needed)
router.get('/user/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const sessions = await TestSession.findByUser(req.params.userId, limit);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching user test sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

module.exports = router;
