import { useState, useEffect, useRef } from "react";

/**
 * useTestTimer
 * 
 * Responsibilities:
 * - Offset-based server sync (drift-proof).
 * - Countdown calculation.
 * - Providing formatted time.
 * 
 * Rule: Pure coordinator. Does not call submit APIs directly.
 */
export default function useTestTimer({
    initialRemaining,
    serverTimeMs,
    endTimeMs,
    isActive,
    onExpire
}) {
    const [timeRemaining, setTimeRemaining] = useState(initialRemaining);
    const clockOffsetRef = useRef(0);
    const sessionEndTimeRef = useRef(endTimeMs);

    // Synchronize when terminal/session props change
    useEffect(() => {
        if (serverTimeMs && endTimeMs) {
            const clientNow = Date.now();
            // Calculate offset: positive = server ahead, negative = server behind
            clockOffsetRef.current = serverTimeMs - clientNow;
            sessionEndTimeRef.current = endTimeMs;

            const correctedNow = clientNow + clockOffsetRef.current;
            const remaining = Math.max(0, Math.floor((endTimeMs - correctedNow) / 1000));
            setTimeRemaining(remaining);

            console.log('[useTestTimer] Synced with server. Remaining:', remaining, 's');
        }
    }, [serverTimeMs, endTimeMs]);

    useEffect(() => {
        if (!isActive || sessionEndTimeRef.current === null) return;

        const interval = setInterval(() => {
            const correctedNow = Date.now() + clockOffsetRef.current;
            const remaining = Math.max(0, Math.floor((sessionEndTimeRef.current - correctedNow) / 1000));

            setTimeRemaining(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                if (onExpire) onExpire();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, onExpire]);

    const formatTime = (seconds) => {
        if (seconds === null || seconds === undefined) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    return {
        timeRemaining,
        isExpired: timeRemaining === 0,
        formatTime: () => formatTime(timeRemaining)
    };
}
