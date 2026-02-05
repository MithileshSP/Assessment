const { query, queryOne } = require("../database/connection");
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
            const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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
                let isExpired = false;
                let endTime = null;
                let record = null;

                // 2. Find their latest attendance record (regardless of is_used status)
                const attendance = await query(
                    `SELECT * FROM test_attendance 
                     WHERE user_id = ?
                     ORDER BY requested_at DESC LIMIT 1`,
                    [student.id]
                );

                if (attendance.length === 0) {
                    // FALLBACK: If student is unblocked but has NO record, skip.
                    // Previously this auto-blocked for security, but it's too aggressive 
                    // and clobbers manual admin unblocks before the student can enter.
                    console.log(`🛡️  SessionGuardian: Student ${student.username} is unblocked but has no attendance record. Waiting for entry.`);
                    continue;
                } else {
                    record = attendance[0];
                    if (record.session_id === null || record.session_id === undefined) {
                        // If unblocked but no session ID, assume they belong to the current window
                        const GlobalSession = require("../models/GlobalSession");
                        const activeSessions = await GlobalSession.getAllActive();
                        const liveSessions = activeSessions.filter(s => s.status === 'live');
                        if (liveSessions.length === 0) isExpired = true;
                        else continue;
                    } else {
                        // 3. Determine expiration based on session type
                        if (record.session_id.toString().startsWith('daily_')) {
                            // Daily Recurring Session
                            const dailyId = record.session_id.split('_')[1];
                            const daily = await queryOne("SELECT * FROM daily_schedules WHERE id = ?", [dailyId]);

                            if (daily) {
                                endTime = new Date(`${today}T${daily.end_time}`);
                                if (now > endTime) {
                                    isExpired = true;
                                    console.log(`🛡️  SessionGuardian: Daily session ${record.session_id} expired at ${endTime.toISOString()}. Student ${student.username} is still unblocked.`);
                                }
                            }
                        } else {
                            // Manual Global Session
                            const gs = await queryOne("SELECT * FROM global_test_sessions WHERE id = ?", [record.session_id]);
                            if (gs) {
                                const startTime = new Date(gs.start_time);
                                endTime = new Date(startTime.getTime() + gs.duration_minutes * 60000);
                                if (now > endTime) {
                                    isExpired = true;
                                    console.log(`🛡️  SessionGuardian: Manual session ${record.session_id} expired at ${endTime.toISOString()}. Student ${student.username} is still unblocked.`);
                                }
                            } else {
                                // If session ID exists but session record is gone, assume it's old and expired
                                isExpired = true;
                                console.log(`🛡️  SessionGuardian: Session ${record.session_id} record not found for student ${student.username}. Assuming expired.`);
                            }
                        }
                    }
                }

                // 4. If session window has ended, auto-block and complete active test session
                if (isExpired) {
                    console.log(`🛡️  SessionGuardian: Auto-blocking ${student.username}...`);

                    // Update user status
                    await query("UPDATE users SET is_blocked = 1 WHERE id = ?", [student.id]);

                    // Mark attendance as used if record exists
                    if (record) {
                        await query("UPDATE test_attendance SET is_used = 1 WHERE id = ?", [record.id]);
                    }

                    // 5. Find and complete any active test_sessions for this student
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
