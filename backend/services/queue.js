/**
 * Simple Concurrency Queue
 * Prevents "Out of Memory" crashes by limiting simultaneous Puppeteer instances.
 */
class RequestQueue {
    constructor(concurrency = 2) {
        this.concurrency = concurrency; // Max simultaneous jobs
        this.running = 0;
        this.queue = [];
    }

    /**
     * Add a job to the queue
     * @param {Function} taskFunction - Async function to execute
     * @returns {Promise} - Resolves with the result of taskFunction
     */
    add(taskFunction) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFunction, resolve, reject });
            this.processNext();
        });
    }

    async processNext() {
        // If we're at max concurrency or no jobs waiting, stop
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const job = this.queue.shift();

        try {
            console.log(`[Queue] Starting job. Active: ${this.running}, Waiting: ${this.queue.length}`);
            const result = await job.taskFunction();
            job.resolve(result);
        } catch (error) {
            console.error(`[Queue] Job failed:`, error.message);
            job.reject(error);
        } finally {
            this.running--;
            console.log(`[Queue] Job finished. Active: ${this.running}, Waiting: ${this.queue.length}`);
            // Trigger next job immediately
            this.processNext();
        }
    }

    getStats() {
        return {
            active: this.running,
            waiting: this.queue.length,
            concurrency: this.concurrency
        };
    }
}

// Global singleton instance
// Limit to 2 concurrent evaluations (safe for 2GB RAM)
module.exports = new RequestQueue(2);
