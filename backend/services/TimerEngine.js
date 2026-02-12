/**
 * TimerEngine — Centralized personal timer computation.
 * 
 * Single source of truth for ALL timer logic across:
 *   - attendance/status (computes level end_time for frontend)
 *   - sessionValidator (validates submission timing)
 *   - SessionGuardian (detects expired students)
 * 
 * Timer model: GLOBAL PER LEVEL
 *   levelEndTime = MIN(scheduleEnd, scheduleStart + timeLimitMinutes)
 *   All students on the same level see the same end time.
 * 
 * Pure functions. No DB calls. No side effects. Deterministic.
 */
class TimerEngine {
    /**
     * Compute the level end time based on schedule start + level time limit.
     * Formula: MIN(scheduleEnd, scheduleStart + timeLimitMinutes)
     * 
     * This is a GLOBAL timer — same for all students on the same level.
     * 
     * @param {Date|string} scheduleStartTime - The schedule window's absolute start
     * @param {Date|string} scheduleEndTime - The schedule window's absolute end
     * @param {number} timeLimitMinutes - Per-level duration in minutes (0 = full window)
     * @returns {{ levelEndTime: Date, source: string }}
     */
    static computeLevelEndTime(scheduleStartTime, scheduleEndTime, timeLimitMinutes) {
        const scheduleStart = new Date(scheduleStartTime);
        const scheduleEnd = new Date(scheduleEndTime);

        // No timeLimit configured → use full schedule window
        if (!timeLimitMinutes || timeLimitMinutes <= 0) {
            return { levelEndTime: scheduleEnd, source: 'schedule' };
        }

        const levelEnd = new Date(
            scheduleStart.getTime() + timeLimitMinutes * 60000
        );

        // Return the EARLIER of schedule end and level end
        if (levelEnd < scheduleEnd) {
            return { levelEndTime: levelEnd, source: 'level_limit' };
        }
        return { levelEndTime: scheduleEnd, source: 'schedule_cap' };
    }

    /**
     * Backward-compatible alias for existing callers.
     * Maps old (scheduleEnd, attemptStartedAt, timeLimit) → new (scheduleStart, scheduleEnd, timeLimit)
     * 
     * @deprecated Use computeLevelEndTime instead
     */
    static computePersonalEndTime(scheduleEndTime, scheduleStartOrAttempt, timeLimitMinutes) {
        // If called with schedule start, use it as the anchor
        const result = this.computeLevelEndTime(scheduleStartOrAttempt, scheduleEndTime, timeLimitMinutes);
        return { personalEndTime: result.levelEndTime, source: result.source };
    }

    /**
     * Check if a level's timer has expired.
     * 
     * @param {Date|string} scheduleStartTime
     * @param {Date|string} scheduleEndTime
     * @param {number} timeLimitMinutes
     * @param {number} gracePeriodMs - Grace period in ms (default 30s)
     * @returns {boolean}
     */
    static isExpired(scheduleStartTime, scheduleEndTime, timeLimitMinutes, gracePeriodMs = 30000) {
        const { levelEndTime } = this.computeLevelEndTime(
            scheduleStartTime, scheduleEndTime, timeLimitMinutes
        );
        return Date.now() > levelEndTime.getTime() + gracePeriodMs;
    }

    /**
     * Resolve timeLimit for a given course and level.
     * Fallback chain: level_settings[level].timeLimit → restrictions.timeLimit → 0
     * 
     * @param {object} courseData - Object with `restrictions` and `level_settings` (or `levelSettings`)
     * @param {number|string} level
     * @returns {number} timeLimit in minutes
     */
    static resolveTimeLimit(courseData, level) {
        if (!courseData) return 0;

        // 1. Check level_settings first (per-level override)
        let levelSettings = courseData.level_settings || courseData.levelSettings;
        if (typeof levelSettings === 'string') {
            try { levelSettings = JSON.parse(levelSettings); } catch { levelSettings = {}; }
        }
        const levelKey = String(level);
        if (levelSettings?.[levelKey]?.timeLimit > 0) {
            return levelSettings[levelKey].timeLimit;
        }

        // 2. Fallback to course-level restrictions
        let restrictions = courseData.restrictions;
        if (typeof restrictions === 'string') {
            try { restrictions = JSON.parse(restrictions); } catch { restrictions = {}; }
        }
        return restrictions?.timeLimit || 0;
    }
}

module.exports = TimerEngine;
