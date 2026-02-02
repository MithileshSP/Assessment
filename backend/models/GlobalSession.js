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
     * Get active session for course/level
     * Refactored to support Daily Recurring Schedules
     */
    static async findActive(course_id, level) {
        // 1. Check for explicit manual session first
        const session = await queryOne(
            "SELECT * FROM global_test_sessions WHERE course_id = ? AND level = ? AND is_active = TRUE",
            [course_id, level]
        );

        if (session) {
            const formatted = this._formatSession(session);
            const now = new Date();
            const endTime = new Date(formatted.end_time);

            if (now > endTime) {
                await this.end(session.id, 'TIMEOUT');
                // Don't return null yet, check daily schedule fallback
            } else {
                return formatted;
            }
        }

        // 2. DAILY SCHEDULE FALLBACK: Check all recurring schedules
        const dailySchedules = await query("SELECT start_time, end_time FROM daily_schedules WHERE is_active = TRUE");

        if (dailySchedules && dailySchedules.length > 0) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];

            for (const daily of dailySchedules) {
                // Create full date-time objects for today's window
                const startTime = new Date(`${today}T${daily.start_time}`);
                const endTime = new Date(`${today}T${daily.end_time}`);

                if (now >= startTime && now <= endTime) {
                    // Return a "Virtual Session" that behaves like a global session for the student UI
                    return {
                        id: 'daily_recurring',
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

        // Logic for Graceful Termination (FIX 4): Mark all associated attendance as used
        // This will be handled in the attendance/session routes to avoid bulk DB locks during high-traffic
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
