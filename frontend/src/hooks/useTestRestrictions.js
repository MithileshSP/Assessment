import { useEffect, useRef } from "react";

/**
 * useTestRestrictions
 * 
 * Responsibilities:
 * - Detect fullscreen exits.
 * - Detect tab/visibility changes.
 * - Detect copy/paste attempts.
 * 
 * Rule: Only reports violations via onViolation callback. Does not mutate locked state.
 */
export default function useTestRestrictions({
    enabled,
    blockCopy,
    blockPaste,
    forceFullscreen,
    onViolation
}) {
    const lastViolationTime = useRef(0);

    const triggerViolation = (type) => {
        const now = Date.now();
        // 2 second cooldown to prevent multiple alerts for the same action
        if (now - lastViolationTime.current < 2000) return;

        lastViolationTime.current = now;
        if (onViolation) onViolation(type);
    };

    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                triggerViolation("Tab switching detected");
            }
        };

        const handleFullscreenChange = () => {
            if (forceFullscreen && !document.fullscreenElement) {
                triggerViolation("Fullscreen exited");
            }
        };

        const handleCopy = (e) => {
            if (blockCopy) {
                e.preventDefault();
                triggerViolation("Copying blocked");
            }
        };

        const handlePaste = (e) => {
            if (blockPaste) {
                e.preventDefault();
                triggerViolation("Pasting blocked");
            }
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            triggerViolation("Right-click blocked");
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("copy", handleCopy);
        document.addEventListener("paste", handlePaste);
        document.addEventListener("contextmenu", handleContextMenu);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("copy", handleCopy);
            document.removeEventListener("paste", handlePaste);
            document.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [enabled, blockCopy, blockPaste, forceFullscreen, onViolation]);

    return null; // Side-effect only hook
}
