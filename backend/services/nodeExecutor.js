/**
 * Node.js Code Executor Service
 * Executes JavaScript code in a sandboxed environment
 * Supports input files and captures stdout/stderr
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class NodeExecutor {
    constructor() {
        this.timeout = 5000; // 5 second max execution time
        this.maxOutputSize = 50000; // 50KB max output
    }

    /**
     * Execute Node.js code with optional input files
     * @param {string} code - JavaScript code to execute
     * @param {Object} files - Additional files { 'input.txt': 'content', ... }
     * @param {number} timeout - Execution timeout in ms
     * @returns {Object} { output, error, executionTime, exitCode }
     */
    async execute(code, files = {}, timeout = this.timeout, stdin = "") {
        const executionId = crypto.randomUUID();
        const tempDir = path.join(os.tmpdir(), `node-exec-${executionId}`);

        try {
            // Create temp directory
            fs.mkdirSync(tempDir, { recursive: true });

            // Write the main script
            const scriptPath = path.join(tempDir, 'script.js');
            fs.writeFileSync(scriptPath, code);

            // Write additional files (like input.txt)
            for (const [filename, content] of Object.entries(files)) {
                const filePath = path.join(tempDir, filename);
                fs.writeFileSync(filePath, content);
            }

            // Execute the script
            const result = await this._runScript(scriptPath, tempDir, timeout, stdin);

            return result;

        } catch (error) {
            return {
                output: '',
                error: error.message,
                executionTime: 0,
                exitCode: 1
            };
        } finally {
            // Cleanup temp directory
            this._cleanup(tempDir);
        }
    }

    /**
     * Run the script in a child process
     * @private
     */
    _runScript(scriptPath, cwd, timeout, stdin = "") {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let stdout = '';
            let stderr = '';
            let killed = false;

            const child = spawn('node', [scriptPath], {
                cwd,
                timeout,
                env: {
                    ...process.env,
                    NODE_ENV: 'sandbox'
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Pipe stdin if provided and always end the stream
            if (stdin !== undefined && stdin !== null) {
                child.stdin.write(String(stdin));
            }
            child.stdin.end();

            // Set up timeout
            const timer = setTimeout(() => {
                killed = true;
                child.kill('SIGTERM');
            }, timeout);

            child.stdout.on('data', (data) => {
                if (stdout.length < this.maxOutputSize) {
                    stdout += data.toString();
                }
            });

            child.stderr.on('data', (data) => {
                if (stderr.length < this.maxOutputSize) {
                    stderr += data.toString();
                }
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                const executionTime = Date.now() - startTime;

                if (killed) {
                    resolve({
                        output: stdout,
                        error: `Execution timed out after ${timeout}ms`,
                        executionTime,
                        exitCode: -1,
                        timedOut: true
                    });
                } else {
                    resolve({
                        output: stdout,
                        error: stderr || null,
                        executionTime,
                        exitCode: code
                    });
                }
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    output: '',
                    error: err.message,
                    executionTime: Date.now() - startTime,
                    exitCode: 1
                });
            });
        });
    }

    /**
     * Clean up temp directory
     * @private
     */
    _cleanup(dir) {
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Cleanup error:', e.message);
        }
    }

    /**
     * Compare output with expected output
     * @param {string} actual - Actual output from execution
     * @param {string} expected - Expected output
     * @returns {Object} { passed, score, details }
     */
    compareOutput(actual, expected) {
        // Normalize outputs (trim, normalize line endings)
        const normalizeOutput = (str) => {
            return str
                .replace(/\r\n/g, '\n')
                .trim()
                .split('\n')
                .map(line => line.trim())
                .join('\n');
        };

        const normalizedActual = normalizeOutput(actual || '');
        const normalizedExpected = normalizeOutput(expected || '');

        if (normalizedActual === normalizedExpected) {
            return {
                passed: true,
                score: 100,
                details: 'Output matches exactly'
            };
        }

        // Calculate line-by-line similarity
        const actualLines = normalizedActual.split('\n');
        const expectedLines = normalizedExpected.split('\n');
        const maxLines = Math.max(actualLines.length, expectedLines.length);

        let matchedLines = 0;
        const differences = [];

        for (let i = 0; i < maxLines; i++) {
            const actualLine = actualLines[i] || '';
            const expectedLine = expectedLines[i] || '';

            if (actualLine === expectedLine) {
                matchedLines++;
            } else {
                differences.push({
                    line: i + 1,
                    expected: expectedLine,
                    actual: actualLine
                });
            }
        }

        const score = Math.round((matchedLines / maxLines) * 100);

        return {
            passed: score >= 70,
            score,
            details: differences.length > 0
                ? `${differences.length} line(s) differ`
                : 'Partial match',
            differences: differences.slice(0, 5) // First 5 differences
        };
    }
}

module.exports = new NodeExecutor();
