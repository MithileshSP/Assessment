const { query } = require("../database/connection");
const TestSession = require("../models/TestSession");

/**
 * SessionGuardian
 * Periodically checks for students whose session window has expired and re-blocks them.
 */
class SessionGuardian {
    constructor() {
        this.interval = null;
        this.isProcessing = false;
    }

    /**
     * Start the guardian
     * @param {number} intervalMs - Frequency of checks (default 1 minute)
     */
    start(intervalMs = 60000) {
        if (this.interval) return;

        console.log(`🛡️  SessionGuardian started (Interval: ${intervalMs}ms)`);

        // Initial check after short delay
        setTimeout(() => this.checkAndBlock(), 5000);

        this.interval = setInterval(() => {
            this.checkAndBlock();
        }, intervalMs);
    }

    /**
     * Stop the guardian
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /**
     * Core logic: Find unblocked students with expired sessions and block them
     */
    async checkAndBlock() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const now = new Date();

            // 1. Find all students who are currently unblocked (is_blocked = 0)
            const unblockedStudents = await query(
                "SELECT id, username, email FROM users WHERE is_blocked = 0 AND role = 'student'"
            );

            if (unblockedStudents.length === 0) {
                this.isProcessing = false;
                return;
            }

            console.log(`🛡️  SessionGuardian: Checking ${unblockedStudents.length} unblocked students...`);

            for (const student of unblockedStudents) {
                // 2. Find their latest active attendance record linked to a session
                const attendance = await query(
                    `SELECT ta.*, gs.end_time 
           FROM test_attendance ta
           JOIN global_sessions gs ON ta.session_id = gs.id
           WHERE ta.user_id = ? AND ta.is_used = 0
           ORDER BY ta.requested_at DESC LIMIT 1`,
                    [student.id]
                );

                if (attendance.length === 0) {
                    // No active session-linked attendance, might be a manual unblock without a session
                    // We only auto-block if there's an expired session window
                    continue;
                }

                const record = attendance[0];
                const endTime = new Date(record.end_time);

                // 3. If session window has ended, auto-block and complete active test session
                if (now > endTime) {
                    console.log(`🛡️  SessionGuardian: Session expired for ${student.username}. Auto-blocking...`);

                    // Update user status
                    await query("UPDATE users SET is_blocked = 1 WHERE id = ?", [student.id]);

                    // Mark attendance as used
                    await query("UPDATE test_attendance SET is_used = 1 WHERE id = ?", [record.id]);

                    // 4. Find and complete any active test_sessions for this student
                    const activeSessions = await query(
                        "SELECT id FROM test_sessions WHERE user_id = ? AND completed_at IS NULL",
                        [student.id]
                    );

                    for (const session of activeSessions) {
                        try {
                            console.log(`🛡️  SessionGuardian: Force-completing test session ${session.id}...`);
                            await TestSession.complete(session.id, {
                                user_feedback: "Session automatically terminated by System Guardian (time window expired)."
                            });
                        } catch (e) {
                            console.error(`🛡️  SessionGuardian: Failed to complete session ${session.id}:`, e.message);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("🛡️  SessionGuardian Error:", error.message);
        } finally {
            this.isProcessing = false;
        }
    }
}

module.exports = new SessionGuardian();
