const { query, queryOne } = require('../database/connection');

class GlobalSession {
    /**
     * Start a new global test session
     */
    static async start(course_id, level, duration_minutes, created_by) {
        // 1. Deactivate any existing active session for same course/level
        await query(
            "UPDATE global_test_sessions SET is_active = FALSE, ended_reason = 'FORCED', forced_end = TRUE WHERE course_id = ? AND level = ? AND is_active = TRUE",
            [course_id, level]
        );

        // 2. Create new session
        const result = await query(
            "INSERT INTO global_test_sessions (course_id, level, duration_minutes, created_by, is_active) VALUES (?, ?, ?, ?, TRUE)",
            [course_id, level, duration_minutes, created_by]
        );

        return this.findById(result.insertId);
    }

    /**
     * Find session by ID
     */
    static async findById(id) {
        const session = await queryOne("SELECT * FROM global_test_sessions WHERE id = ?", [id]);
        return session ? this._formatSession(session) : null;
    }

    /**
     * Get all active sessions (Manual + Recurring)
     */
    static async getAllActive() {
        const now = new Date();
        const allSessions = [];

        // 1. Daily schedules
        const dailySchedules = await query("SELECT * FROM daily_schedules WHERE is_active = TRUE");

        // Enforce IST (Asia/Kolkata) for date comparison
        const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        for (let i = 0; i < dailySchedules.length; i++) {
            const daily = dailySchedules[i];
            const startTime = new Date(`${today}T${daily.start_time}`);
            const endTime = new Date(`${today}T${daily.end_time}`);

            let status = 'upcoming';
            if (now > endTime) status = 'ended';
            else if (now >= startTime) status = 'live';

            allSessions.push({
                id: `daily_${daily.id}`,
                type: 'recurring',
                title: `Session ${i + 1}: ${daily.start_time.slice(0, 5)} - ${daily.end_time.slice(0, 5)}`,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                server_time: now.toISOString(),
                server_time_ms: now.getTime(),
                duration_minutes: (endTime - startTime) / 60000,
                is_active: status === 'live',
                status: status
            });
        }

        // 2. Manual Global Sessions
        const manualSessions = await query("SELECT * FROM global_test_sessions WHERE is_active = TRUE");
        for (const session of manualSessions) {
            const formatted = this._formatSession(session);
            allSessions.push({
                ...formatted,
                id: session.id,
                type: 'manual',
                title: `Manual Session (Level ${session.level})`,
                status: formatted.is_expired ? 'ended' : 'live'
            });
        }

        // Sort by start time
        return allSessions.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }

    /**
     * Get active session for course/level
     * Refactored to support BOTH Manual and Daily Recurring Schedules
     */
    static async findActive(course_id, level) {
        // 1. Check MANUAL GLOBAL SESSION first (Highest priority)
        const manualSession = await queryOne(
            "SELECT * FROM global_test_sessions WHERE course_id = ? AND level = ? AND is_active = TRUE",
            [course_id, level]
        );

        if (manualSession) {
            const formatted = this._formatSession(manualSession);
            if (!formatted.is_expired) {
                return formatted;
            }
        }

        // 2. Check DAILY RECURRING SCHEDULES
        const dailySchedules = await query("SELECT id, start_time, end_time FROM daily_schedules WHERE is_active = TRUE");

        if (dailySchedules && dailySchedules.length > 0) {
            const now = new Date();
            const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            for (const daily of dailySchedules) {
                // Create full date-time objects for today's window
                const startTime = new Date(`${today}T${daily.start_time}`);
                const endTime = new Date(`${today}T${daily.end_time}`);

                if (now >= startTime && now <= endTime) {
                    // Return a "Virtual Session" that behaves like a global session for the student UI
                    return {
                        id: 'daily_' + daily.id,
                        course_id: course_id,
                        level: level,
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString(),
                        server_time: now.toISOString(),
                        server_time_ms: now.getTime(),
                        duration_minutes: (endTime - startTime) / 60000,
                        is_active: true,
                        is_recurring: true,
                        is_expired: false
                    };
                }
            }
        }

        return null;
    }

    /**
     * End a session
     */
    static async end(id, reason = 'NORMAL') {
        await query(
            "UPDATE global_test_sessions SET is_active = FALSE, ended_reason = ?, forced_end = ? WHERE id = ?",
            [reason, reason === 'FORCED', id]
        );

        // Graceful Termination (FIX 4): Mark attendance as used and re-block students
        try {
            // 1. Get all students linked to this session via test_attendance
            const linkedAttendance = await query(
                "SELECT DISTINCT user_id FROM test_attendance WHERE session_id = ? AND is_used = FALSE",
                [id]
            );

            if (linkedAttendance.length > 0) {
                const userIds = linkedAttendance.map(a => a.user_id);

                // 2. Mark all attendance records for this session as used
                await query(
                    "UPDATE test_attendance SET is_used = TRUE WHERE session_id = ?",
                    [id]
                );

                // 3. Re-block all linked students
                await query(
                    `UPDATE users SET is_blocked = TRUE WHERE id IN (?) AND role = 'student'`,
                    [userIds]
                );

                console.log(`[GlobalSession] Session ${id} ended (${reason}). Re-blocked ${userIds.length} students.`);
            }
        } catch (e) {
            console.error('[GlobalSession] Graceful termination error:', e.message);
        }

        return this.findById(id);
    }

    /**
     * Format session data
     */
    static _formatSession(session) {
        const start = new Date(session.start_time);
        const end = new Date(start.getTime() + session.duration_minutes * 60000);
        const now = new Date();

        return {
            ...session,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            server_time: now.toISOString(),  // For client offset calculation
            server_time_ms: now.getTime(),   // Milliseconds for precise calculation
            duration_minutes: session.duration_minutes,
            is_expired: now > end
        };
    }
}

module.exports = GlobalSession;
