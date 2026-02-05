const { queryOne } = require('../database/connection');

/**
 * validateSessionActive
 * 
 * Verifies if a test session is still within its valid time window.
 * Checks against both manual global sessions and daily recurring schedules.
 */
async function validateSessionActive(sessionId, userId) {
    if (!sessionId) return false;

    try {
        // 1. Check if it's a daily session (daily_XX)
        if (typeof sessionId === 'string' && sessionId.startsWith('daily_')) {
            const dailyId = sessionId.split('_')[1];
            const now = new Date();
            const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            const daily = await queryOne("SELECT * FROM daily_schedules WHERE id = ? AND is_active = 1", [dailyId]);
            if (!daily) return false;

            const endTime = new Date(`${today}T${daily.end_time}`);
            // Add a 30-second grace period for late network packets
            if (now.getTime() > endTime.getTime() + 30000) {
                console.warn(`[SessionValidator] Daily session ${sessionId} expired for user ${userId}`);
                return false;
            }
            return true;
        }

        // 2. Check if it's a manual global session
        const gs = await queryOne("SELECT * FROM global_test_sessions WHERE id = ? AND is_active = 1", [sessionId]);
        if (gs) {
            const now = new Date();
            const startTime = new Date(gs.start_time);
            const endTime = new Date(startTime.getTime() + gs.duration_minutes * 60000);

            // Add a 30-second grace period
            if (now.getTime() > endTime.getTime() + 30000) {
                console.warn(`[SessionValidator] Manual session ${sessionId} expired for user ${userId}`);
                return false;
            }
            return true;
        }

        // 3. Fallback: Check if user is blocked (authoritative kill switch)
        const user = await queryOne("SELECT is_blocked FROM users WHERE id = ?", [userId]);
        if (user && user.is_blocked) {
            console.warn(`[SessionValidator] User ${userId} is blocked. Rejecting session ${sessionId}`);
            return false;
        }

        return false;
    } catch (err) {
        console.error('[SessionValidator] Error:', err.message);
        return false;
    }
}

module.exports = { validateSessionActive };
