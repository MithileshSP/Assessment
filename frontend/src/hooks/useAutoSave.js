import { useState, useEffect, useRef } from "react";
import api from "../services/api";

/**
 * useAutoSave
 * 
 * Responsibilities:
 * - Tracking dirty questions/files.
 * - Periodic idempotent batch saves.
 * - Handling save status.
 */
export default function useAutoSave({
    userId,
    courseId,
    level,
    sessionId,
    isActive,
    saveInterval = 30000
}) {
    const [dirtyQuestions, setDirtyQuestions] = useState(new Set());
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
    const [lastSaveTime, setLastSaveTime] = useState(null);
    const isSavingRef = useRef(false);

    // We use a ref to store the latest data to avoid stale closures in setInterval
    const dataRef = useRef({ userAnswers: {}, currentCode: {}, currentQuestionId: null });

    const markDirty = (questionId, data) => {
        setDirtyQuestions(prev => new Set(prev).add(questionId));
        dataRef.current.userAnswers[questionId] = data;
        if (dataRef.current.currentQuestionId === questionId) {
            dataRef.current.currentCode = data;
        }
    };

    const syncCurrentState = (questionId, code) => {
        dataRef.current.currentQuestionId = questionId;
        dataRef.current.currentCode = code;
    };

    const performSave = async (force = false) => {
        if ((dirtyQuestions.size === 0 && !force) || isSavingRef.current || !isActive) return;

        isSavingRef.current = true;
        setSaveStatus('saving');

        try {
            const submissionsToSave = [];
            const questionsToClear = Array.from(dirtyQuestions);

            questionsToClear.forEach(qId => {
                const qCode = dataRef.current.userAnswers[qId];
                if (qCode && (qCode.html || qCode.css || qCode.js)) {
                    submissionsToSave.push({
                        challengeId: qId,
                        userId,
                        courseId,
                        level: parseInt(level),
                        sessionId, // Mandatory for security/idempotency
                        code: qCode,
                        candidateName: localStorage.getItem('username') || 'Student'
                    });
                }
            });

            if (submissionsToSave.length > 0) {
                await api.post('/submissions/batch', {
                    submissions: submissionsToSave,
                    courseId,
                    level: parseInt(level),
                    sessionId
                });
            }

            setDirtyQuestions(prev => {
                const next = new Set(prev);
                questionsToClear.forEach(id => next.delete(id));
                return next;
            });
            setSaveStatus('saved');
            setLastSaveTime(new Date());
        } catch (err) {
            console.error('[useAutoSave] Batch save failed:', err);
            setSaveStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    };

    useEffect(() => {
        if (!isActive) return;

        const interval = setInterval(() => {
            performSave();
        }, saveInterval);

        return () => clearInterval(interval);
    }, [isActive, saveInterval, dirtyQuestions.size]);

    return {
        markDirty,
        syncCurrentState,
        saveStatus,
        lastSaveTime,
        performSave: () => performSave(true)
    };
}
