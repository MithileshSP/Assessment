/**
 * Code Execution Routes
 * Handles server-side code execution for Node.js challenges
 */

const express = require('express');
const router = express.Router();
const nodeExecutor = require('../services/nodeExecutor');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/execute
 * Execute code and return output
 * Body: { code: string, files?: { filename: content }, language: 'nodejs' }
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const { code, files = {}, language = 'nodejs', timeout = 5000, stdin = "" } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        if (language !== 'nodejs') {
            return res.status(400).json({ error: 'Only nodejs execution is supported' });
        }

        // Limit timeout to max 10 seconds
        const safeTimeout = Math.min(timeout, 10000);

        console.log(`[Execute] Running ${language} code for user ${req.user.id}`);

        const result = await nodeExecutor.execute(code, files, safeTimeout, stdin);

        console.log(`[Execute] Completed in ${result.executionTime}ms, exit code: ${result.exitCode}`);

        res.json({
            success: result.exitCode === 0,
            output: result.output,
            error: result.error,
            executionTime: result.executionTime,
            timedOut: result.timedOut || false
        });

    } catch (error) {
        console.error('[Execute] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Execution failed: ' + error.message
        });
    }
});

/**
 * POST /api/execute/evaluate
 * Execute code and compare with expected output
 * Body: { code, files, expectedOutput }
 */
router.post('/evaluate', verifyToken, async (req, res) => {
    try {
        const { code, files = {}, expectedOutput, timeout = 5000 } = req.body;

        if (!code || !expectedOutput) {
            return res.status(400).json({ error: 'Code and expectedOutput are required' });
        }

        const safeTimeout = Math.min(timeout, 10000);

        console.log(`[Execute/Evaluate] Running evaluation for user ${req.user.id}`);

        const result = await nodeExecutor.execute(code, files, safeTimeout);

        if (result.exitCode !== 0 && !result.output) {
            return res.json({
                success: false,
                passed: false,
                score: 0,
                output: result.output,
                error: result.error || 'Execution failed',
                executionTime: result.executionTime
            });
        }

        // Compare output
        const comparison = nodeExecutor.compareOutput(result.output, expectedOutput);

        console.log(`[Execute/Evaluate] Score: ${comparison.score}%, Passed: ${comparison.passed}`);

        res.json({
            success: true,
            passed: comparison.passed,
            score: comparison.score,
            output: result.output,
            error: result.error,
            executionTime: result.executionTime,
            details: comparison.details,
            differences: comparison.differences
        });

    } catch (error) {
        console.error('[Execute/Evaluate] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Evaluation failed: ' + error.message
        });
    }
});

module.exports = router;
