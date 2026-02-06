const { query, queryOne } = require("../database/connection");
const TestSession = require("../models/TestSession");

/**
 * SessionGuardian
 * - Activates pre-authorized (scheduled) students when their session goes LIVE
 * - Re-blocks students when their session window expires
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

        // Initial check after short delay - BLOCK FIRST, then activate
        setTimeout(async () => {
            await this.blockExpiredSessionStudents();
            await this.checkAndBlock();
            await this.activateScheduledStudents();
        }, 5000);

        this.interval = setInterval(async () => {
            // CRITICAL: Block expired students BEFORE activating new ones
            await this.blockExpiredSessionStudents();
            await this.checkAndBlock();
            await this.activateScheduledStudents();
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
     * v3.6.1: FIRST block all students whose sessions have ended
     */
    async blockExpiredSessionStudents() {
        try {
            const GlobalSession = require("../models/GlobalSession");
            const now = new Date();

            // Get all sessions that have ended
            const allSessions = await GlobalSession.getAllActive();
            const endedSessions = allSessions.filter(s => s.status === 'ended');

            for (const session of endedSessions) {
                // Find students who are still unblocked and linked to this ended session
                const activeInEndedSession = await query(
                    `SELECT ta.id, ta.user_id, u.username, u.is_blocked 
                     FROM test_attendance ta 
                     JOIN users u ON ta.user_id = u.id 
                     WHERE ta.session_id = ? AND u.is_blocked = 0 AND ta.scheduled_status = 'activated'`,
                    [session.id]
                );

                if (activeInEndedSession.length > 0) {
                    console.log(`🛡️  SessionGuardian: Session ${session.id} has ENDED. Re-blocking ${activeInEndedSession.length} students...`);

                    for (const record of activeInEndedSession) {
                        await query("UPDATE users SET is_blocked = 1 WHERE id = ?", [record.user_id]);
                        await query("UPDATE test_attendance SET scheduled_status = 'expired', is_used = 1 WHERE id = ?", [record.id]);
                        console.log(`🛡️  SessionGuardian: Re-blocked ${record.username} (session ${session.id} ended)`);
                    }
                }
            }

            // Also check for sessions that are past their time window even if still 'live'
            const liveSessions = allSessions.filter(s => s.status === 'live');
            for (const session of liveSessions) {
                const startTime = new Date(session.start_time);
                const endTime = new Date(startTime.getTime() + session.duration_minutes * 60000);

                if (now > endTime) {
                    // Session is past its end time but still marked as live
                    const stillActive = await query(
                        `SELECT ta.id, ta.user_id, u.username 
                         FROM test_attendance ta 
                         JOIN users u ON ta.user_id = u.id 
                         WHERE ta.session_id = ? AND u.is_blocked = 0 AND ta.scheduled_status = 'activated'`,
                        [session.id]
                    );

                    if (stillActive.length > 0) {
                        console.log(`🛡️  SessionGuardian: Session ${session.id} is OVERTIME (ended at ${endTime.toISOString()}). Re-blocking ${stillActive.length} students...`);

                        for (const record of stillActive) {
                            await query("UPDATE users SET is_blocked = 1 WHERE id = ?", [record.user_id]);
                            await query("UPDATE test_attendance SET scheduled_status = 'expired', is_used = 1 WHERE id = ?", [record.id]);
                            console.log(`🛡️  SessionGuardian: Re-blocked ${record.username} (session overtime)`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("🛡️  SessionGuardian: Error blocking expired session students:", error.message);
        }
    }

    /**
     * v3.6.0: Activate students who are SCHEDULED for sessions that are now LIVE
     */
    async activateScheduledStudents() {
        try {
            const GlobalSession = require("../models/GlobalSession");
            const allSessions = await GlobalSession.getAllActive();
            const liveSessions = allSessions.filter(s => s.status === 'live');

            if (liveSessions.length === 0) return;

            for (const session of liveSessions) {
                // Find all students scheduled for this session
                const scheduledRecords = await query(
                    "SELECT ta.id, ta.user_id, u.username FROM test_attendance ta JOIN users u ON ta.user_id = u.id WHERE ta.session_id = ? AND ta.scheduled_status = 'scheduled'",
                    [session.id]
                );

                if (scheduledRecords.length > 0) {
                    console.log(`🛡️  SessionGuardian: Session ${session.id} is LIVE. Activating ${scheduledRecords.length} scheduled students...`);

                    for (const record of scheduledRecords) {
                        // Unblock the user
                        await query("UPDATE users SET is_blocked = 0 WHERE id = ?", [record.user_id]);
                        // Update attendance status
                        await query("UPDATE test_attendance SET scheduled_status = 'activated' WHERE id = ?", [record.id]);
                        console.log(`🛡️  SessionGuardian: Activated ${record.username} for session ${session.id}`);
                    }
                }
            }
        } catch (error) {
            console.error("🛡️  SessionGuardian: Error activating scheduled students:", error.message);
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
                    // If unblocked but NO record, check if there are ANY LIVE sessions.
                    // If no live sessions exist, they have no reason to be unblocked.
                    const GlobalSession = require("../models/GlobalSession");
                    const allSessions = await GlobalSession.getAllActive();
                    const liveSessions = allSessions.filter(s => s.status === 'live');
                    if (liveSessions.length === 0) {
                        isExpired = true;
                        console.log(`🛡️  SessionGuardian: Student ${student.username} is unblocked with no record and no LIVE sessions. Auto-blocking.`);
                    } else {
                        continue; // Wait for them to enter an active session
                    }
                } else {
                    record = attendance[0];

                    if (record.session_id === null || record.session_id === undefined) {
                        // If unblocked but no session ID, check for currently live sessions only
                        const GlobalSession = require("../models/GlobalSession");
                        const allSessions = await GlobalSession.getAllActive();
                        const liveSessions = allSessions.filter(s => s.status === 'live');
                        if (liveSessions.length === 0) {
                            isExpired = true;
                            console.log(`🛡️  SessionGuardian: Student ${student.username} has attendance but no session_id and no LIVE sessions. Auto-blocking.`);
                        } else {
                            continue;
                        }
                    } else {
                        // 3. Determine expiration based on session type
                        let startTime = null;
                        if (record.session_id.toString().startsWith('daily_')) {
                            // Daily Recurring Session
                            const dailyId = record.session_id.split('_')[1];
                            const daily = await queryOne("SELECT * FROM daily_schedules WHERE id = ?", [dailyId]);

                            if (daily) {
                                startTime = new Date(`${today}T${daily.start_time}`);
                                endTime = new Date(`${today}T${daily.end_time}`);
                                if (now > endTime) {
                                    isExpired = true;
                                    console.log(`🛡️  SessionGuardian: Daily session ${record.session_id} expired at ${endTime.toISOString()}. Student ${student.username} is still unblocked.`);
                                } else if (now < startTime) {
                                    isExpired = true;
                                    console.log(`🛡️  SessionGuardian: Daily session ${record.session_id} hasn't started yet (starts at ${startTime.toISOString()}). Student ${student.username} is unblocked prematurely.`);
                                }
                            } else {
                                isExpired = true;
                                console.log(`🛡️  SessionGuardian: Daily session ${record.session_id} not found. Auto-blocking ${student.username}.`);
                            }
                        } else {
                            // Manual Global Session
                            const gs = await queryOne("SELECT * FROM global_test_sessions WHERE id = ?", [record.session_id]);
                            if (gs) {
                                startTime = new Date(gs.start_time);
                                endTime = new Date(startTime.getTime() + gs.duration_minutes * 60000);
                                if (now > endTime || !gs.is_active) {
                                    isExpired = true;
                                    console.log(`🛡️  SessionGuardian: Manual session ${record.session_id} expired or inactive. Student ${student.username} is still unblocked.`);
                                } else if (now < startTime) {
                                    isExpired = true;
                                    console.log(`🛡️  SessionGuardian: Manual session ${record.session_id} hasn't started yet (starts at ${startTime.toISOString()}). Student ${student.username} is unblocked prematurely.`);
                                }
                            } else {
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
