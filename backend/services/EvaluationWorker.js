/**
 * Evaluation Worker
 * Background process to pick up queued submissions and run evaluation
 */
const SubmissionModel = require('../models/Submission');
const ChallengeModel = require('../models/Challenge');
const evaluator = require('./evaluator');

class EvaluationWorker {
    constructor() {
        this.isProcessing = false;
        this.pollInterval = null;
        this.concurrencyLimit = 2; // Maximum simultaneous evaluations
        this.activeWorkers = 0;
    }

    /**
     * Start the worker loop
     */
    start() {
        console.log('👷 Evaluation Worker: Started');
        this.pollInterval = setInterval(() => this.processNext(), 5000); // Check every 5 seconds
        this.processNext(); // Run once immediately
    }

    /**
     * Stop the worker
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('👷 Evaluation Worker: Stopped');
    }

    /**
     * Pick up and process the next queued submission
     */
    async processNext() {
        if (this.activeWorkers >= this.concurrencyLimit) {
            return;
        }

        try {
            const submission = await SubmissionModel.findNextQueued();

            if (!submission) {
                return;
            }

            this.activeWorkers++;
            this._runEvaluation(submission).catch(err => {
                console.error(`👷 Evaluation Worker Error [${submission.id}]:`, err);
                this.activeWorkers--;
            }).then(() => {
                this.activeWorkers--;
                // If we finished and have capacity, try to process another immediately
                setImmediate(() => this.processNext());
            });

        } catch (error) {
            console.error('👷 Evaluation Worker: Failed to poll queue:', error);
        }
    }

    /**
     * Internal evaluation logic
     */
    async _runEvaluation(submission) {
        const submissionId = submission.id;
        console.log(`\n🔄 [Queue] Starting evaluation for submission: ${submissionId}`);

        try {
            // 1. Mark as evaluating
            await SubmissionModel.updateStatus(submissionId, SubmissionModel.STATUS.EVALUATING);

            // 2. Get challenge
            const challengeId = submission.challengeId;
            const challenge = await ChallengeModel.findById(challengeId);

            if (!challenge) {
                throw new Error(`Challenge ${challengeId} not found`);
            }

            // 3. Run evaluation
            const evaluationResult = await evaluator.evaluate(
                submission.code,
                challenge.expected_solution || challenge.expectedSolution,
                challenge.passing_threshold || challenge.passingThreshold,
                submissionId,
                challengeId
            );

            // 4. Save result
            await SubmissionModel.updateEvaluation(submissionId, evaluationResult);

            console.log(`✅ [Queue] Evaluation complete for ${submissionId}: ${evaluationResult.passed ? "PASSED" : "FAILED"}`);
        } catch (error) {
            console.error(`❌ [Queue] Evaluation failed for ${submissionId}:`, error.message);
            await SubmissionModel.updateStatus(submissionId, SubmissionModel.STATUS.ERROR);
        }
    }
}

// Singleton instance
module.exports = new EvaluationWorker();
