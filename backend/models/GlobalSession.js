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
     */
    static async findActive(course_id, level) {
        const session = await queryOne(
            "SELECT * FROM global_test_sessions WHERE course_id = ? AND level = ? AND is_active = TRUE",
            [course_id, level]
        );

        if (!session) return null;

        const formatted = this._formatSession(session);

        // Auto-expiry logic (FIX 2)
        const now = new Date();
        const endTime = new Date(formatted.end_time);

        if (now > endTime) {
            await this.end(session.id, 'TIMEOUT');
            return null;
        }

        return formatted;
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

        return {
            ...session,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            duration_minutes: session.duration_minutes,
            is_expired: new Date() > end
        };
    }
}

module.exports = GlobalSession;
