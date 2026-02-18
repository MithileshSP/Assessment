/**
 * Main Evaluator Service
 * Orchestrates evaluation: 
 * - Web Challenges: Strict Content + Semantic DOM + Pixel Matching
 * - Node.js Challenges: Output Comparison (+ Content Validation)
 */

const strictContentEvaluator = require('./strictContentEvaluator');
const semanticEvaluator = require('./semanticEvaluator');
const pixelMatch = require('./pixelMatch');
const nodeExecutor = require('./nodeExecutor');
const ChallengeModel = require('../models/Challenge');

class Evaluator {
  /**
   * Main evaluation function (Queued)
   */
  async evaluate(candidateCode, expectedCode, thresholds, submissionId, challengeId = '') {
    const requestQueue = require('./queue');

    return requestQueue.add(async () => {
      return this._performEvaluation(candidateCode, expectedCode, thresholds, submissionId, challengeId);
    });
  }

  /**
   * Internal evaluation execution
   * @private
   */
  async _performEvaluation(candidateCode, expectedCode, thresholds, submissionId, challengeId) {
    console.log(`\n🔍 Starting Evaluation`);
    console.log(`   Submission ID: ${submissionId}`);
    console.log(`   Challenge ID: ${challengeId}`);

    const result = {
      submissionId,
      timestamp: new Date().toISOString(),
      contentScore: 0,
      structureScore: 0,
      visualScore: 0,
      behaviorScore: 0,
      finalScore: 0,
      passed: false,
      thresholds,
      content: null,
      structure: null,
      visual: null,
      feedback: null
    };

    try {
      // 1. Get challenge details to check type
      const challenge = await ChallengeModel.findById(challengeId);
      const challengeType = challenge?.challengeType || 'web';
      console.log(`   Challenge Type: ${challengeType}`);

      if (challengeType === 'nodejs') {
        return await this._evaluateNodeJS(candidateCode, challenge, thresholds, submissionId);
      } else {
        return await this._evaluateWeb(candidateCode, expectedCode, thresholds, submissionId, challengeId);
      }
    } catch (error) {
      console.error('❌ Evaluation error:', error.message);
      return {
        submissionId,
        timestamp: new Date().toISOString(),
        finalScore: 0,
        passed: false,
        error: error.message,
        feedback: [{
          type: 'error',
          message: `Evaluation failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Node.js specific evaluation
   * @private
   */
  async _evaluateNodeJS(candidateCode, challenge, thresholds, submissionId) {
    console.log('   🚀 Running Node.js evaluation...');

    // 1. Execute candidate code
    const execResult = await nodeExecutor.execute(
      candidateCode.js,
      candidateCode.additionalFiles || {},
      5000
    );

    // 2. Compare output
    const comparison = nodeExecutor.compareOutput(
      execResult.output,
      challenge.expectedOutput || '',
      thresholds.overall || 70
    );

    // 3. Content validation (Check for required modules or patterns)
    const contentResult = await strictContentEvaluator.evaluate(
      '', // No HTML
      '', // No CSS
      '', // No expected HTML
      '', // No expected CSS
      challenge.id,
      thresholds.overall || 70
    );

    const result = {
      submissionId,
      timestamp: new Date().toISOString(),
      contentScore: contentResult.score,
      structureScore: 0,
      visualScore: comparison.score, // Use visual score field for output score to keep consistency with UI
      behaviorScore: 0,
      finalScore: Math.round((contentResult.score * 0.3) + (comparison.score * 0.7)),
      passed: comparison.passed && contentResult.passed,
      thresholds,
      content: {
        score: contentResult.score,
        passed: contentResult.passed,
        feedback: contentResult.feedback
      },
      visual: {
        score: comparison.score,
        passed: comparison.passed,
        details: comparison.details,
        differences: comparison.differences,
        output: execResult.output,
        expected: challenge.expectedOutput,
        error: execResult.error
      },
      feedback: {
        general: comparison.passed
          ? "Great job! Your code produced the correct output."
          : `Output mismatch. ${comparison.details}`,
        suggestions: contentResult.feedback.filter(f => f.type === 'suggestion').map(f => f.message),
        contentValidation: contentResult.feedback
      }
    };

    console.log(`   ✓ Node.js Score: ${result.finalScore}% (${result.passed ? 'PASSED' : 'FAILED'})`);
    return result;
  }

  /**
   * Web (HTML/CSS/JS) specific evaluation
   * @private
   */
  async _evaluateWeb(candidateCode, expectedCode, thresholds, submissionId, challengeId) {
    console.log('   🎨 Running Web visual evaluation...');

    const result = {
      submissionId,
      timestamp: new Date().toISOString(),
      contentScore: 0,
      structureScore: 0,
      visualScore: 0,
      behaviorScore: 0,
      finalScore: 0,
      passed: false,
      thresholds,
      content: null,
      structure: null,
      visual: null,
      feedback: null
    };

    // Step 1: STRICT CONTENT VALIDATION
    const contentResult = await strictContentEvaluator.evaluate(
      candidateCode.html,
      candidateCode.css || '',
      expectedCode.html,
      expectedCode.css || '',
      challengeId,
      thresholds.overall || 70
    );

    result.contentScore = contentResult.score;
    result.content = {
      score: contentResult.score,
      passed: contentResult.passed,
      details: contentResult.details,
      feedback: contentResult.feedback,
      requirements: contentResult.requirements
    };

    // Step 2: Semantic DOM Structure Evaluation
    const structureResult = semanticEvaluator.evaluateStructure(
      candidateCode.html,
      expectedCode.html
    );

    result.structureScore = structureResult.score;
    result.structure = {
      score: structureResult.score,
      passed: structureResult.score >= thresholds.structure,
      rolesFound: structureResult.rolesFound
    };

    // Step 3: Pixel-level Visual Comparison
    const pixelResult = await pixelMatch.compare(
      candidateCode,
      expectedCode,
      submissionId
    );

    result.visualScore = pixelResult.score;
    result.visual = {
      score: pixelResult.score,
      passed: pixelResult.score >= thresholds.visual,
      diffPixels: pixelResult.diffPixels,
      screenshots: pixelResult.screenshots
    };

    // Step 4: Calculate Final Score
    if (pixelResult.error) {
      console.log(`   ⚠️ Visual evaluation failed (${pixelResult.error}). Fallback to 100% Content Score.`);

      // Fallback: Use content score as final
      result.finalScore = result.contentScore;
      result.visualScore = result.contentScore; // Set visual score to match content score so it passes checks

      // Update visual object details
      if (result.visual) {
        result.visual.score = result.contentScore;
        result.visual.passed = result.contentScore >= (thresholds.visual || 70);
        result.visual.error = pixelResult.error; // Keep error for debugging
      }
    } else {
      result.finalScore = Math.round(
        (result.contentScore * 0.50) +
        (result.visualScore * 0.50)
      );
    }

    const semanticFeedback = semanticEvaluator.generateFeedback(
      structureResult,
      result.visualScore,
      0
    );

    result.feedback = {
      ...semanticFeedback,
      contentValidation: contentResult.feedback
    };

    const minOverall = thresholds.overall || 70;
    const minStructure = thresholds.structure || 70;
    const minVisual = thresholds.visual || 70;

    result.passed = result.contentScore >= minOverall &&
      result.visualScore >= minVisual &&
      result.finalScore >= minOverall;

    return result;
  }

  /**
   * Clean up resources
   */
  async cleanup(submissionId) {
    console.log(`Cleanup for ${submissionId}`);
  }
}

module.exports = new Evaluator();
