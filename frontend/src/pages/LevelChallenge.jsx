import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, CheckCircle, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Check, Layout, Star } from "lucide-react";
import MultiFileEditor from "../components/MultiFileEditor";
import TerminalPanel from "../components/TerminalPanel";
import PreviewFrame from "../components/PreviewFrame";
import ResultsPanel from "../components/ResultsPanel";
import api from "../services/api";

export default function LevelChallenge() {
  const { courseId, level } = useParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId") || "default-user";

  const [assignedQuestions, setAssignedQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState({ html: "", css: "", js: "", additionalFiles: {} });
  const [submitting, setSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState("");
  const [result, setResult] = useState(null);
  const [previewTab, setPreviewTab] = useState("live");
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showEvaluationPanel, setShowEvaluationPanel] = useState(true);
  const [userAnswers, setUserAnswers] = useState({});
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [testSessionId, setTestSessionId] = useState(null);
  const [finishingLevel, setFinishingLevel] = useState(false);
  const [stdin, setStdin] = useState("");
  const [metrics, setMetrics] = useState(null);

  // Restrictions and Timer State
  const [restrictions, setRestrictions] = useState({
    blockCopy: false,
    blockPaste: false,
    forceFullscreen: false,
    maxViolations: 3,
    timeLimit: 0,
  });
  const [violations, setViolations] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showViolationToast, setShowViolationToast] = useState(false);
  const [violationMessage, setViolationMessage] = useState("");
  const [lastViolationTime, setLastViolationTime] = useState(0);

  const previewRef = useRef();
  const [fullScreenView, setFullScreenView] = useState(null); // 'live' | 'expected' | null
  const [isLocked, setIsLocked] = useState(false); // Test locked due to violations
  const lockedCodeRef = useRef(null); // Stores code state synchronously at lock time
  const clockOffsetRef = useRef(0); // Server time offset: serverTime - clientTime
  const sessionEndTimeRef = useRef(null); // Absolute end time from server
  const [lastSaveTime, setLastSaveTime] = useState(null); // Auto-save indicator
  const [isSaving, setIsSaving] = useState(false);

  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState('loading'); // loading, none, requested, approved, rejected
  const [attendanceTimer, setAttendanceTimer] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [showNavWarning, setShowNavWarning] = useState(false); // Navigation warning state
  const [studentInfo, setStudentInfo] = useState(null); // To store Name, RollNo, Email, Course

  // Batch Saving State
  const [dirtyQuestions, setDirtyQuestions] = useState(new Set()); // IDs of modified questions
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState(null);



  useEffect(() => {
    if (assignedQuestions.length > 0) {
      loadCurrentQuestion();
    }
  }, [currentQuestionIndex, assignedQuestions]);

  // Check Attendance and Restrictions on Mount
  useEffect(() => {
    if (courseId && level) {
      checkAttendance();
      loadRestrictions(); // Initial load for instant application
    }
    return () => {
      clearInterval(attendanceTimer);
      if (unlockPollRef.current) clearInterval(unlockPollRef.current);
    };
  }, [courseId, level]);


  const checkAttendance = async () => {
    // Admin bypass - skip attendance check entirely
    // Admin bypass - set status but allow loading restrictions/session
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      setAttendanceStatus('started');
      // Continue to load restrictions and session for timer visibility
    }

    try {
      // Note: Submissions check removed from here because it blocks the 'Request New Attempt' flow.
      // The attendance status (isUsed) is now the sole source of truth for blocking.
      const res = await api.get('/attendance/status', { params: { courseId, level } });
      const { status, session, isUsed, locked, isBlocked } = res.data;

      // New Logic: Check global is_blocked status first
      if (isBlocked) {
        setAttendanceStatus('blocked');
        setLoading(false);
        return;
      }

      if (locked) {
        setAttendanceStatus('started');
        setLoading(false);
        // Delay to ensure attendanceStatus is 'started' before handleLockTest runs
        setTimeout(() => handleLockTest(restrictions.maxViolations || 3), 100);
        return;
      }

      if (isUsed) {
        // Check if there are pending submissions (not yet evaluated)
        try {
          const submissionsRes = await api.get('/submissions/user-level', {
            params: { userId, courseId, level }
          });
          const submissions = submissionsRes.data || [];
          const hasPendingEvaluation = submissions.some(s => s.status === 'pending');

          if (hasPendingEvaluation) {
            setAttendanceStatus('pending_evaluation');
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to check pending submissions:', e.message);
        }

        setAttendanceStatus('used');
        setLoading(false);
        return;
      }

      setAttendanceStatus(status);
      if (res.data.studentDetails) {
        setStudentInfo(res.data.studentDetails);
      }

      if (session) {
        // OFFSET-BASED TIMER: Calculate clock offset from server
        const clientNow = Date.now();
        const serverNow = session.server_time_ms || new Date(session.server_time).getTime();
        const endTime = new Date(session.end_time).getTime();

        // Calculate offset: positive = server ahead, negative = server behind
        clockOffsetRef.current = serverNow - clientNow;
        sessionEndTimeRef.current = endTime;

        // Calculate remaining using offset-corrected time
        const correctedNow = clientNow + clockOffsetRef.current;
        const remaining = Math.max(0, Math.floor((endTime - correctedNow) / 1000));
        setTimeRemaining(remaining);

        console.log('[Timer] Offset calculated:', clockOffsetRef.current, 'ms, Remaining:', remaining, 's');

        // Load session restrictions if needed
        setRestrictions(prev => ({ ...prev, timeLimit: session.duration_minutes }));
      }

      // Check for active test session to auto-resume
      const sessionRes = await api.post("/test-sessions", {
        user_id: userId,
        course_id: courseId,
        level: parseInt(level),
      });

      // If session already completed, check for pending submissions
      if (sessionRes.data && sessionRes.data.completed_at) {
        try {
          const submissionsRes = await api.get('/submissions/user-level', {
            params: { userId, courseId, level }
          });
          const submissions = submissionsRes.data || [];
          const hasPendingEvaluation = submissions.some(s => s.status === 'pending');

          if (hasPendingEvaluation) {
            setAttendanceStatus('pending_evaluation');
            setLoading(false);
            return;
          } else {
            // Test completed and evaluated - show 'used' status
            setAttendanceStatus('used');
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to check pending submissions:', e.message);
        }
      }

      if (sessionRes.data && !sessionRes.data.completed_at) {
        setTestSessionId(sessionRes.data.id);
        if (sessionRes.data.started_at) setStartedAt(sessionRes.data.started_at);
      }

      // If not blocked, and not in an active session, we basically just let them in
      if (!isBlocked) {
        setAttendanceStatus('approved');

        // Timer Fallback: If no server session but we have restrictions
        if (!session && !sessionEndTimeRef.current && restrictions.timeLimit > 0) {
          const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
          const durationMs = restrictions.timeLimit * 60 * 1000;
          const endTime = startTime + durationMs;

          sessionEndTimeRef.current = endTime;
          clockOffsetRef.current = 0; // Local time for local timer
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setTimeRemaining(remaining);
          console.log('[Timer] Using local fallback timer. Remaining:', remaining, 's');
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Attendance check failed", error);
      setAttendanceStatus('none'); // Safe fallback
      setLoading(false);
    }
  };

  const [isRequesting, setIsRequesting] = useState(false);

  const requestAttendance = async () => {
    // This is now disabled
    alert('Direct unblocking is required by administrator.');
  };

  const startTest = () => {
    loadLevelQuestions();
    loadRestrictions();
    setAttendanceStatus('started'); // distinct state to hide the wall

    // Request fullscreen on user gesture (Button click)
    if (restrictions.forceFullscreen) {
      document.documentElement.requestFullscreen?.().catch((err) => {
        console.warn('Initial fullscreen request failed:', err.message);
      });
    }
  };

  const loadLevelQuestions = async () => {
    try {
      const response = await api.get(`/challenges/level-questions`, {
        params: {
          userId,
          courseId,
          level: parseInt(level),
          // Removed forceNew: "true" to allow persistence
        },
      });

      let questions = response.data.assignedQuestions || [];

      if (questions.length === 0) {
        alert("No questions assigned for this level");
        navigate(`/course/${courseId}`);
        return;
      }

      // Restore from localStorage if possible - BUT only if questions match
      const storageKey = `assessment_${userId}_${courseId}_${level}`;
      const savedState = localStorage.getItem(storageKey);

      if (savedState) {
        try {
          const { questions: savedQs, answers, currentIndex, code: savedCode } = JSON.parse(savedState);

          // Compare question IDs from API with saved state
          // If they differ, a reset has happened - use fresh questions
          const apiQuestionIds = questions.map(q => q.id).sort().join(',');
          const savedQuestionIds = savedQs.map(q => q.id).sort().join(',');

          if (apiQuestionIds === savedQuestionIds) {
            // Same questions - restore saved state
            setAssignedQuestions(savedQs);
            setUserAnswers(answers);
            setCurrentQuestionIndex(currentIndex);
            setCode(savedCode);
            setLoading(false);
            return;
          } else {
            // Questions have changed (reset occurred) - clear old state
            console.log('Questions reassigned, clearing old localStorage state');
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          console.error("Failed to restore state", e);
          localStorage.removeItem(storageKey);
        }
      }

      // If no saved state, initialize new
      setAssignedQuestions(questions);

      // Initialize answers
      const initialAnswers = {};
      questions.forEach((q) => {
        initialAnswers[q.id] = {
          html: "",
          css: "",
          js: "",
          additionalFiles: {},
          submitted: false,
          result: null,
        };
      });
      setUserAnswers(initialAnswers);

      // Create test session
      await createTestSession();

      try {
        const restrictionsRes = await api.get(`/courses/${courseId}/restrictions`);
        if (restrictionsRes.data) {
          // Merge with existing state (to preserve timeLimit set by session)
          setRestrictions(prev => ({ ...prev, ...restrictionsRes.data }));
          console.log('Loaded restrictions (merged):', restrictionsRes.data);
        }
      } catch (e) {
        console.warn('Failed to load restrictions, using defaults:', e.message);
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load level questions:", error);
      alert("Failed to load questions");
      setLoading(false);
    }
  };

  const createTestSession = async () => {
    try {
      const response = await api.post("/test-sessions", {
        user_id: userId,
        course_id: courseId,
        level: parseInt(level),
      });

      console.log("Session sync:", response.data.id);
      setTestSessionId(response.data.id);
      if (response.data.started_at) {
        setStartedAt(response.data.started_at);
      }
    } catch (error) {
      console.error("Failed to sync session:", error);
    }
  };

  // Track dirty state when code changes
  useEffect(() => {
    if (assignedQuestions.length > 0 && assignedQuestions[currentQuestionIndex]) {
      const currentQId = assignedQuestions[currentQuestionIndex].id;
      // Only mark dirty if code is actually different from saved/initial state
      // For simplicity, we assume any edit makes it dirty, and we clear dirty on save
      setDirtyQuestions(prev => {
        const newSet = new Set(prev);
        newSet.add(currentQId);
        return newSet;
      });

      // Update local storage backup immediately
      const storageKey = `assessment_${userId}_${courseId}_${level}`;
      localStorage.setItem(storageKey, JSON.stringify({
        questions: assignedQuestions,
        answers: {
          ...userAnswers,
          [currentQId]: { ...userAnswers[currentQId], ...code } // Update with current code
        },
        currentIndex: currentQuestionIndex,
        code
      }));
    }
  }, [code]);

  // Update userAnswers when switching questions or code changes
  useEffect(() => {
    if (assignedQuestions[currentQuestionIndex]) {
      setUserAnswers(prev => ({
        ...prev,
        [assignedQuestions[currentQuestionIndex].id]: {
          ...prev[assignedQuestions[currentQuestionIndex].id],
          html: code.html,
          css: code.css,
          js: code.js
        }
      }));
    }
  }, [code, currentQuestionIndex, assignedQuestions]);


  // Fisher-Yates shuffle algorithm for randomizing question order
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const loadCurrentQuestion = async () => {
    if (!assignedQuestions[currentQuestionIndex]) return;

    const questionId = assignedQuestions[currentQuestionIndex].id;

    try {
      const response = await api.get(`/challenges/${questionId}`);
      const challengeData = response.data;
      setChallenge(challengeData);

      // Default to terminal tab for nodejs challenges
      const isNodeJS = challengeData.challengeType === 'nodejs';
      if (isNodeJS) {
        setPreviewTab("terminal");
      } else {
        setPreviewTab("live");
      }

      // Load saved answer if exists
      const savedAnswer = userAnswers[questionId];
      if (savedAnswer && (savedAnswer.html || savedAnswer.css || savedAnswer.js)) {
        setCode({
          html: savedAnswer.html,
          css: savedAnswer.css,
          js: savedAnswer.js,
          additionalFiles: savedAnswer.additionalFiles || {},
        });
        setResult(savedAnswer.result);
      } else {
        // Fallback to localStorage or keep current
      }
    } catch (error) {
      console.error("Failed to load question:", error);
    }
  };

  const loadRestrictions = async () => {
    try {
      const response = await api.get(`/courses/${courseId}/restrictions`);
      if (response.data) {
        // Merge with existing state (to preserve timeLimit set by session)
        setRestrictions(prev => ({ ...prev, ...response.data }));
        // Initialize timer if timeLimit is set in fetched results AND not already synced from session
        if (response.data.timeLimit > 0 && timeRemaining === null) {
          const durationSeconds = response.data.timeLimit * 60;
          setTimeRemaining(durationSeconds);

          // Initializing sessionEndTimeRef for local fallback if not already set by a server session
          if (sessionEndTimeRef.current === null) {
            sessionEndTimeRef.current = Date.now() + durationSeconds * 1000;
            console.log('[Timer] Initialized local end-time ref from restrictions:', response.data.timeLimit, 'm');
          }
        }
      }
    } catch (error) {
      console.error("Failed to load restrictions:", error);
    }
  };

  // Sync Timer with Server Session (Offset-Based Sync)
  useEffect(() => {
    let syncTimer;

    const syncWithServer = async () => {
      if (attendanceStatus === 'approved' || attendanceStatus === 'started') {
        try {
          const res = await api.get('/attendance/status', { params: { courseId, level } });
          const { session } = res.data;
          if (session) {
            // OFFSET-BASED SYNC: Recalibrate offset from server
            const clientNow = Date.now();
            const serverNow = session.server_time_ms || new Date(session.server_time).getTime();
            const endTime = new Date(session.end_time).getTime();

            // Update offset (may have drifted)
            clockOffsetRef.current = serverNow - clientNow;
            sessionEndTimeRef.current = endTime;

            // Calculate remaining using offset-corrected time
            const correctedNow = clientNow + clockOffsetRef.current;
            const remaining = Math.max(0, Math.floor((endTime - correctedNow) / 1000));
            setTimeRemaining(remaining);

            console.log('[Sync] Offset recalibrated:', clockOffsetRef.current, 'ms, Remaining:', remaining, 's');

            // If session is expired on server, auto-finish
            if (session.is_expired || remaining <= 0) {
              handleFinishLevel({ reason: "timeout" });
            }
          }
        } catch (err) {
          console.error("Timer sync failed:", err);
        }
      }
    };

    // Initial sync
    syncWithServer();

    // Periodic sync every 30 seconds to prevent drift 
    syncTimer = setInterval(syncWithServer, 30000);

    return () => clearInterval(syncTimer);
  }, [attendanceStatus, courseId, level]);

  useEffect(() => {
    // Only count down if we have started the test
    if (attendanceStatus !== 'started' || isLocked) return;

    const interval = setInterval(() => {
      let remaining = 0;

      if (sessionEndTimeRef.current !== null) {
        // Source A: Absolute end time (drift-proof)
        const correctedNow = Date.now() + clockOffsetRef.current;
        remaining = Math.max(0, Math.floor((sessionEndTimeRef.current - correctedNow) / 1000));
        setTimeRemaining(remaining);
      } else if (timeRemaining !== null && timeRemaining > 0) {
        // Source B: Local relative decrement fallback
        setTimeRemaining(prev => {
          remaining = Math.max(0, (prev || 0) - 1);
          return remaining;
        });
      }

      if (remaining <= 0 && (sessionEndTimeRef.current !== null || (timeRemaining !== null && timeRemaining <= 0))) {
        clearInterval(interval);
        // Unified finish trigger: handleFinishLevel handles both save and submission
        handleFinishLevel({ reason: "timeout" });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attendanceStatus, isLocked, sessionEndTimeRef.current === null]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle violations
  const handleViolation = (type) => {
    const now = Date.now();
    if (now - lastViolationTime < 2000) return; // 2 second cooldown
    if (isLocked) return; // Already locked, ignore further violations

    setLastViolationTime(now);
    const newViolations = violations + 1;
    setViolations(newViolations);

    setViolationMessage(`${type}`);
    setShowViolationToast(true);
    setTimeout(() => setShowViolationToast(false), 3000);

    if (newViolations >= restrictions.maxViolations) {
      // LOCK TEST instead of auto-submit - only if not already locked
      if (!isLocked) {
        handleLockTest(newViolations);
      }
    }
  };

  // Ref to store unlock poll interval for cleanup
  const unlockPollRef = useRef(null);

  // Lock test on max violations
  const handleLockTest = async (violationCount) => {
    // Prevent duplicate calls
    if (isLocked) return;

    setIsLocked(true);
    setViolationMessage("Test Locked. Waiting for admin decision.");
    setShowViolationToast(true);

    // CRITICAL: Capture ALL code synchronously to a ref (React state is async)
    const capturedAnswers = { ...userAnswers };
    if (challenge) {
      capturedAnswers[challenge.id] = {
        html: code.html,
        css: code.css,
        js: code.js,
        additionalFiles: code.additionalFiles
      };
    }
    lockedCodeRef.current = capturedAnswers;
    console.log('[Lock] Captured code to ref:', Object.keys(capturedAnswers));
    console.log('[Lock] Current code state:', { html: code.html?.length || 0, css: code.css?.length || 0, js: code.js?.length || 0 });
    console.log('[Lock] Captured code value:', capturedAnswers[challenge?.id]);

    // Also try async state update for auto-save
    if (challenge) {
      setUserAnswers(prev => ({
        ...prev,
        [challenge.id]: { html: code.html, css: code.css, js: code.js, additionalFiles: code.additionalFiles }
      }));
      setDirtyQuestions(prev => new Set(prev).add(challenge.id));
    }

    // Save current code before locking (wait for state to update)
    await new Promise(resolve => setTimeout(resolve, 100));
    await autoSaveBatch();

    // Notify backend about lock
    try {
      await api.post('/attendance/lock', {
        courseId,
        level: parseInt(level),
        reason: 'Max violations reached',
        violationCount
      });
    } catch (err) {
      console.error('Failed to notify lock:', err);
    }

    // Clear any existing poll
    if (unlockPollRef.current) {
      clearInterval(unlockPollRef.current);
    }

    // Start polling for unlock (only proceed if admin explicitly unlocks)
    unlockPollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/attendance/status', { params: { courseId, level } });
        // Only unlock if locked is explicitly false AND there's an unlock action
        if (res.data && res.data.locked === false && res.data.unlockAction) {
          clearInterval(unlockPollRef.current);
          unlockPollRef.current = null;

          if (res.data.unlockAction === 'submit' || res.data.isUsed) {
            // Admin forced submit
            setIsLocked(false);
            handleFinishTest({ reason: "admin_forced" });
          } else if (res.data.unlockAction === 'continue') {
            // Admin allowed continue
            setIsLocked(false);
            setViolations(0);
            setShowViolationToast(false);
          }
        }
      } catch (e) {
        console.error('Unlock poll error:', e);
      }
    }, 3000);
  };

  // Batch Auto-Save function
  const autoSaveBatch = async () => {
    if (dirtyQuestions.size === 0 || isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const submissionsToSave = [];

      dirtyQuestions.forEach(qId => {
        // Get latest code: if it's current question, use 'code' state, else use 'userAnswers'
        let qCode;
        if (assignedQuestions[currentQuestionIndex] && assignedQuestions[currentQuestionIndex].id === qId) {
          qCode = code;
        } else {
          const ans = userAnswers[qId];
          qCode = { html: ans?.html || '', css: ans?.css || '', js: ans?.js || '' };
        }

        if (qCode.html || qCode.css || qCode.js) {
          submissionsToSave.push({
            challengeId: qId,
            userId,
            code: qCode,
            candidateName: localStorage.getItem('username') || 'Student'
          });
        }
      });

      if (submissionsToSave.length > 0) {
        await api.post('/submissions/batch', {
          submissions: submissionsToSave,
          courseId,
          level: parseInt(level)
        });
      }

      setDirtyQuestions(new Set()); // Clear dirty flags
      setSaveStatus('saved');
      setLastSaveTimestamp(new Date());

    } catch (err) {
      console.error('Batch auto-save failed:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save timer (30 seconds)
  useEffect(() => {
    if (attendanceStatus !== 'started' || isLocked) return;

    const timer = setInterval(() => {
      autoSaveBatch();
    }, 30000);

    return () => clearInterval(timer);
  }, [dirtyQuestions, userAnswers, code, attendanceStatus, isLocked]);

  // Initial save on finish test to ensure everything is synced
  const ensureAllSaved = async () => {
    await autoSaveBatch();
  };

  const forceSubmitCurrentCode = async () => {
    if (!challenge) return null;
    try {
      const response = await api.post("/submissions", {
        challengeId: challenge.id,
        userId: userId,
        code: {
          html: code.html,
          css: code.css,
          js: code.js,
        },
      });
      const submissionId = response.data.submissionId;
      if (testSessionId && submissionId) {
        await api.post(`/test-sessions/${testSessionId}/submissions`, {
          submission_id: submissionId,
        });
      }
      // Update local state so handleFinish can find it
      const updatedAnswers = {
        ...userAnswers,
        [challenge.id]: {
          html: code.html,
          css: code.css,
          js: code.js,
          submitted: true,
          submissionId: submissionId
        }
      };
      setUserAnswers(updatedAnswers);
      return submissionId;
    } catch (err) {
      console.error("Force submission failed", err);
      return null;
    }
  };

  // Restriction enforcement
  useEffect(() => {
    if (
      !restrictions.blockCopy &&
      !restrictions.blockPaste &&
      !restrictions.forceFullscreen
    )
      return;

    const handleCopy = (e) => {
      if (restrictions.blockCopy) {
        e.preventDefault();
        handleViolation("Copy blocked");
      }
    };
    const handlePaste = (e) => {
      if (restrictions.blockPaste) {
        e.preventDefault();
        handleViolation("Paste blocked");
      }
    };
    const handleContextMenu = (e) => {
      if (restrictions.blockCopy || restrictions.blockPaste) {
        e.preventDefault();
      }
    };
    const handleKeyDown = (e) => {
      // Block F12 (DevTools)
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("Security Alert: Developer Tools Access Blocked");
        return false;
      }

      // Block Ctrl+Shift+I/J/C (DevTools shortcuts)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey &&
        ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("Security Alert: Inspect Element Blocked");
        return false;
      }

      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("Security Alert: View Source Blocked");
        return false;
      }

      // Block F5 (Refresh) - optional but prevents accidental loss
      if (e.key === 'F5' || e.keyCode === 116) {
        e.preventDefault();
        return false;
      }

      // Block Alt + Left Arrow (Back), Alt + Right Arrow (Forward), Alt + Home
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home')) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("Security Alert: Browser Navigation Shortcut Blocked");
        return false;
      }

      // Block Escape key when locked
      if (isLocked && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block copy shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        restrictions.blockCopy &&
        (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X")
      ) {
        e.preventDefault();
        handleViolation("Copy shortcut blocked");
      }
      // Block paste shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        restrictions.blockPaste &&
        (e.key === "v" || e.key === "V")
      ) {
        e.preventDefault();
        handleViolation("Paste shortcut blocked");
      }
    };
    const handleVisibilityChange = () => {
      // Detection: tab switch, window minimize, or backgrounding
      if (document.hidden) {
        handleViolation("Security Threat: Unauthorized Window Switch Detected");
      }
    };

    const handleFullscreenChange = () => {
      if (
        restrictions.forceFullscreen &&
        !document.fullscreenElement &&
        violations < restrictions.maxViolations
      ) {
        handleViolation("Security Bypass: User attempted to exit secure mode");
        // Aggressively try to re-enter fullscreen
        const reenterFullscreen = () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {
              // If first attempt fails, keep trying every 500ms
              setTimeout(reenterFullscreen, 500);
            });
          }
        };
        setTimeout(reenterFullscreen, 100);
      }
    };

    document.addEventListener("copy", handleCopy, { capture: true });
    document.addEventListener("cut", handleCopy, { capture: true });
    document.addEventListener("paste", handlePaste, { capture: true });
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Auto-enter fullscreen on click if not in fullscreen
    const handleClickForFullscreen = () => {
      if (restrictions.forceFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    };
    document.addEventListener("click", handleClickForFullscreen);

    if (restrictions.blockCopy) document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("click", handleClickForFullscreen);
      document.removeEventListener("copy", handleCopy, { capture: true });
      document.removeEventListener("cut", handleCopy, { capture: true });
      document.removeEventListener("paste", handlePaste, { capture: true });
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (restrictions.blockCopy) document.body.style.userSelect = "";
    };
  }, [restrictions, violations, lastViolationTime, isLocked]);

  // Navigation blocking - prevent back/forward during test
  useEffect(() => {
    if (attendanceStatus !== 'started') return;

    // Push a state to prevent back navigation
    window.history.pushState({ testInProgress: true }, '', window.location.href);

    const handlePopState = (e) => {
      // Re-push state to keep them on current page
      window.history.pushState({ testInProgress: true }, '', window.location.href);

      // Trigger warning notification
      setShowNavWarning(true);
      setTimeout(() => setShowNavWarning(false), 4000);
    };

    const handleBeforeUnload = (e) => {
      const msg = "Assessment in progress! Are you sure you want to leave? Your progress will be saved, but this session may be invalidated.";
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attendanceStatus, isLocked]);

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      // Save current code
      const currentId = assignedQuestions[currentQuestionIndex].id;
      setUserAnswers((prev) => ({
        ...prev,
        [currentId]: {
          ...prev[currentId],
          html: code.html,
          css: code.css,
          js: code.js,
          additionalFiles: code.additionalFiles || {},
        },
      }));
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setResult(null);
      setPreviewTab("live");
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < assignedQuestions.length - 1) {
      // Save current code
      const currentId = assignedQuestions[currentQuestionIndex].id;
      setUserAnswers((prev) => ({
        ...prev,
        [currentId]: {
          ...prev[currentId],
          html: code.html,
          css: code.css,
          js: code.js,
          additionalFiles: code.additionalFiles || {},
        },
      }));
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setResult(null);
      setPreviewTab("live");
    }
  };

  const handleRunCode = async () => {
    // Determine if this is a nodejs challenge
    const isNodeJS = challenge?.challengeType === 'nodejs' || (code.js && code.js.includes('require(') && !code.html);

    if (isNodeJS) {
      setEvaluating(true);
      setPreviewTab("terminal");
      setConsoleOutput([{ type: 'info', content: 'Running Node.js code...' }]);
      setMetrics(null);

      try {
        const response = await api.executeCode(code.js, code.additionalFiles || {}, 'nodejs', stdin);
        const { output, error, executionTime } = response.data;

        setMetrics({ executionTime, memoryUsage: '44.5 MB' });

        const newLogs = [];
        if (output) {
          output.split('\n').filter(l => l.trim() !== '').forEach(line => {
            newLogs.push({ type: 'log', content: line });
          });
        }

        if (error) {
          error.split('\n').filter(l => l.trim() !== '').forEach(line => {
            newLogs.push({ type: 'error', content: line });
          });
        }

        if (!output && !error) {
          newLogs.push({ type: 'info', content: 'Execution completed with no output.' });
        }

        setConsoleOutput(newLogs);
      } catch (err) {
        setConsoleOutput([{
          type: 'error',
          content: `Execution failed: ${err.response?.data?.error || err.message}`
        }]);
      } finally {
        setEvaluating(false);
      }
    } else {
      // Logic for web challenges
      if (previewRef.current) {
        previewRef.current.updatePreview(code);
      }
    }
  };

  const pollEvaluationResult = async (submissionId, questionId) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes at 5s interval
    const interval = 5000;

    const poll = async () => {
      try {
        const response = await api.post("/evaluate", { submissionId });
        const data = response.data;

        if (data.status === 'passed' || data.status === 'failed') {
          const evalResult = data.result;

          // Save result
          setUserAnswers((prev) => ({
            ...prev,
            [questionId]: {
              html: code.html,
              css: code.css,
              js: code.js,
              additionalFiles: code.additionalFiles || {},
              submitted: true,
              result: evalResult,
              submissionId: submissionId
            },
          }));

          setEvaluationStep("");
          setEvaluating(false);
          setSubmitting(false);
          alert(`Evaluation complete! Result: ${evalResult.passed ? 'PASSED' : 'FAILED'}`);
          return true;
        }

        if (data.status === 'evaluating') {
          setEvaluationStep("Evaluation in progress...");
        } else {
          setEvaluationStep("In execution queue...");
        }

        return false;
      } catch (error) {
        console.error("Polling error:", error);
        return false;
      }
    };

    const timer = setInterval(async () => {
      attempts++;
      const isDone = await poll();
      if (isDone || attempts >= maxAttempts) {
        clearInterval(timer);
        if (attempts >= maxAttempts) {
          setEvaluating(false);
          setSubmitting(false);
          setEvaluationStep("");
          alert("Evaluation timed out. Please check results later.");
        }
      }
    }, interval);
  };

  const computeProgressSummary = () => {
    const results = assignedQuestions.map((q) => {
      const answer = userAnswers[q.id];
      const res = answer?.result || {};
      return {
        questionId: q.id,
        questionTitle: q.title,
        submitted: !!answer?.submitted,
        score: res.finalScore || 0,
        passed: !!res.passed,
      };
    });

    const submittedCount = results.filter((r) => r.submitted).length;
    const passedCount = results.filter((r) => r.passed).length;
    const totalQuestions = assignedQuestions.length;
    const avgScore = totalQuestions > 0 ? results.reduce((sum, r) => sum + r.score, 0) / totalQuestions : 0;

    return {
      results,
      submittedCount,
      passedCount,
      totalQuestions,
      avgScore: Math.round(avgScore),
    };
  };

  const saveCompletionProgress = async (summary, feedbackData = {}) => {
    const payload = {
      userId,
      courseId,
      level: parseInt(level),
      completedAt: new Date().toISOString(),
      finalScore: summary.avgScore,
      passed: summary.passedCount === summary.totalQuestions,
      questionsSubmitted: summary.submittedCount,
      questionsPassed: summary.passedCount,
      totalQuestions: summary.totalQuestions,
      feedback: feedbackData.feedback || "",
      results: summary.results
    };

    try {
      // Step 1: Tell TestSession we are done (updates session state and attendance)
      if (testSessionId) {
        await api.put(`/test-sessions/${testSessionId}/complete`, {
          user_feedback: payload.feedback
        });
      }

      // Step 2: Save high-level completion progress (for course stats/unlocking)
      const response = await api.post('/level-completion', payload);
      return response.data;
    } catch (err) {
      console.error("Save completion failed:", err);
      throw err;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);

    const questionId = challenge.id;

    if ((!code.html || code.html.trim() === '') && (!code.js || code.js.trim() === '')) {
      alert("Please write some code (HTML or JavaScript) before submitting.");
      setSubmitting(false);
      return;
    }

    // Save locally only - actual DB submission happens on Finish Test
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        html: code.html,
        css: code.css,
        js: code.js,
        additionalFiles: code.additionalFiles || {},
        submitted: true,
        result: { status: 'saved' } // Local save only
      },
    }));

    // Answer saved silently - final submission happens on Finish Test
    setSubmitting(false);
  };

  const handleFinishLevel = async ({ reason = "manual", forceSubmissionId = null } = {}) => {
    if (finishingLevel) return;

    // For timeout, we show a non-dismissible loading state immediately
    if (reason === "timeout") {
      setFinishingLevel(true);
    }

    // Ensure final state is saved
    try {
      await ensureAllSaved();
    } catch (e) {
      console.warn("Final save warning:", e);
    }

    handleFinishTest({ reason, forceSubmissionId });
  };

  const handleFinishTest = async ({ reason = "manual", forceSubmissionId = null } = {}) => {
    setFinishingLevel(true);
    let lastSubmissionId = forceSubmissionId;

    // If it's a timeout, give the user a clear message
    if (reason === "timeout") {
      setEvaluationStep("Time expired. Submitting your work...");
    } else if (reason === "admin_forced") {
      setEvaluationStep("Session ended by admin. Submitting work...");
    }

    try {
      // Step 1: Submit final code for ALL questions (even if not previously submitted)
      console.log('[FinishTest] Submitting final code for all questions...', { reason, assignedQuestions: assignedQuestions.length });

      // For admin_forced, use the code captured at lock time (synchronous ref)
      const codeSource = (reason === 'admin_forced' && lockedCodeRef.current)
        ? lockedCodeRef.current
        : userAnswers;

      const submissionRequests = assignedQuestions.map(async (question) => {
        const savedAnswer = codeSource[question.id];
        const isCurrentQuestion = currentQuestionIndex === assignedQuestions.indexOf(question);

        // Use current 'code' state for current question (only if not admin_forced), fallback to saved
        let currentCode;
        if (reason !== 'admin_forced' && isCurrentQuestion && (code.html || code.css || code.js)) {
          currentCode = code;
        } else {
          currentCode = {
            html: savedAnswer?.html || '',
            css: savedAnswer?.css || '',
            js: savedAnswer?.js || '',
            additionalFiles: savedAnswer?.additionalFiles || {}
          };
        }

        // Only submit if there's any code
        if (currentCode.html || currentCode.css || currentCode.js) {
          try {
            const response = await api.post("/submissions", {
              challengeId: question.id,
              userId: userId,
              code: currentCode,
            });
            const submissionId = response.data.submissionId;

            // Link to test session
            if (testSessionId && submissionId) {
              await api.post(`/test-sessions/${testSessionId}/submissions`, {
                submission_id: submissionId,
              }).catch(e => console.warn(`[FinishTest] Failed to link submission ${submissionId}:`, e.message));
            }

            return submissionId;
          } catch (submitError) {
            console.error(`[FinishTest] Failed to submit question ${question.id}:`, submitError.message);
            return null;
          }
        }
        return null;
      });

      // Execute all submissions in parallel but catch individual errors
      const results = await Promise.all(submissionRequests);
      const successfulSubmissions = results.filter(id => id !== null);
      if (successfulSubmissions.length > 0) {
        lastSubmissionId = successfulSubmissions[successfulSubmissions.length - 1];
      }

      console.log(`[FinishTest] Successfully submitted ${successfulSubmissions.length} questions.`);

      // Step 2: Tell TestSession we are done
      if (testSessionId) {
        let feedbackMsg = "";
        if (reason === "violations") feedbackMsg = "Session terminated due to security violations.";
        else if (reason === "admin_forced") feedbackMsg = "Session terminated by administrator decision.";
        else if (reason === "timeout") feedbackMsg = "Session terminated due to time limit.";

        try {
          await api.put(`/test-sessions/${testSessionId}/complete`, {
            user_feedback: feedbackMsg
          });
        } catch (completeErr) {
          console.error('[FinishTest] Failed to complete test session:', completeErr.message);
        }
      }

      // Step 3: Clear localStorage to prevent re-entry with cached state
      const storageKey = `assessment_${userId}_${courseId}_${level}`;
      localStorage.removeItem(storageKey);

      // Step 4: Redirect
      if (reason === "violations") {
        navigate(`/level-results/${courseId}/${level}`);
        return;
      }

      // Admin forced or Timeout submit should go to feedback/results
      if (reason === "admin_forced" || reason === "timeout") {
        // Fallback: If lastSubmissionId is null (e.g. empty code submitted now), check for ANY existing submission
        if (!lastSubmissionId) {
          const allSubmissionIds = Object.values(userAnswers)
            .map(a => a.submissionId)
            .filter(id => id);
          if (allSubmissionIds.length > 0) {
            lastSubmissionId = allSubmissionIds[allSubmissionIds.length - 1]; // Use the most recent one we have locally
          }
        }

        if (lastSubmissionId) {
          navigate(`/student/feedback/${lastSubmissionId}`);
        } else {
          // Attempt to show results even if no code was submitted during this specific sequence
          navigate(`/level-results/${courseId}/${level}`, {
            state: {
              message: reason === "timeout"
                ? 'Time expired. Your session has ended.'
                : 'Your session was ended by the administrator.'
            }
          });
        }
        return;
      }

      // Navigate to feedback page with last submission ID
      if (lastSubmissionId) {
        navigate(`/student/feedback/${lastSubmissionId}`);
      } else {
        navigate(`/level-results/${courseId}/${level}`);
      }
    } catch (error) {
      console.error('Error finishing test:', error);
      navigate(`/course/${courseId}`);
    } finally {
      setFinishingLevel(false);
      setEvaluationStep("");
    }
  };


  const allQuestionsSubmitted = () => {
    return assignedQuestions.every((q) => userAnswers[q.id]?.submitted);
  };

  if (loading && attendanceStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Verifying Credentials...</p>
      </div>
    );
  }

  if (attendanceStatus !== 'started') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200 text-center max-w-5xl w-full border border-slate-100 animate-fade-in relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50" />

          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-xl shadow-blue-500/10 relative z-10 transition-transform hover:scale-110 duration-500">
            <Layout size={40} />
          </div>

          {attendanceStatus === 'blocked' ? (
            <div className="animate-fade-in text-center">
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Access Restricted</h2>
              <p className="text-slate-500 font-medium mb-10 leading-relaxed">
                Your entry to this assessment is currently gated.
                <br />
                Please wait for your instructor to grant you access.
              </p>

              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Identity Verification</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Student:</span>
                      <span className="font-bold text-slate-800">{localStorage.getItem('fullName') || 'Unknown Student'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono text-xs text-slate-600">{localStorage.getItem('userEmail') || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/course/${courseId}`)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                >
                  <ArrowLeft size={18} />
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Security Checkpoint</h2>
              <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                Administrative verification successful. Please review the instructions before starting.
              </p>

              {(attendanceStatus === 'approved' || attendanceStatus === 'none' || userRole === 'admin') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                  {/* Left Column: Details */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Candidate Information</p>
                      <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-100 uppercase tracking-tight">
                        <CheckCircle size={12} />
                        Verified
                      </div>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 grid grid-cols-2 gap-y-10 gap-x-6 backdrop-blur-sm shadow-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">FullName</p>
                        <p className="text-lg font-black text-slate-900 leading-tight">{studentInfo?.fullName || localStorage.getItem('fullName') || 'Unknown'}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Roll Number</p>
                        <p className="text-lg font-black text-slate-900 leading-tight">{studentInfo?.rollNo || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</p>
                        <p className="text-sm font-bold text-slate-600 truncate max-w-[180px]">{studentInfo?.email || 'N/A'}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Authorized Course</p>
                        <p className="text-sm font-black text-indigo-600">{studentInfo?.courseTitle || 'Current Assessment'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/course/${courseId}`)}
                      className="w-full py-4 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-3xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 border border-transparent hover:border-slate-200"
                    >
                      <ArrowLeft size={14} /> Back to Dashboard
                    </button>
                  </div>

                  {/* Right Column: Instructions & Action */}
                  <div className="space-y-6 flex flex-col justify-between">
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden flex-1 shadow-2xl shadow-slate-900/20">
                      <div className="absolute top-0 right-0 p-6 opacity-10">
                        <AlertTriangle size={120} />
                      </div>

                      <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                          <AlertTriangle size={18} />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em]">Security Protocols</p>
                      </div>

                      <ul className="space-y-5 relative z-10">
                        {[
                          "Do NOT switch tabs or minimize window",
                          "Do NOT use Browser Developer Tools",
                          "Do NOT copy content from external sources",
                          `Maximum violations: ${restrictions.maxViolations || 3}`,
                          "Progress is automatically synchronized"
                        ].map((text, i) => (
                          <li key={i} className="flex items-start gap-4 text-[13px] font-medium text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0 shadow-[0_0_10px_#3b82f6]" />
                            {text}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={startTest}
                      className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-4 group active:scale-[0.98] duration-300"
                    >
                      Initialize Assessment
                      <ArrowLeft className="rotate-180 group-hover:translate-x-2 transition-transform duration-500" size={24} />
                    </button>
                  </div>
                </div>
              )}

              {attendanceStatus === 'used' && (
                <div className="space-y-6 animate-fade-in group">
                  <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-600 shadow-inner group-hover:scale-110 transition-transform">
                    <AlertTriangle size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Attempt Completed</h3>
                  <p className="text-slate-500 font-medium">
                    You have already submitted an attempt for this level.
                  </p>
                  <button
                    onClick={() => navigate(`/course/${courseId}`)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={18} />
                    Return to Course
                  </button>
                </div>
              )}
            </>
          )}

          {/* Navigation Attempt Warning */}
          {showNavWarning && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] animate-bounce">
              <div className="bg-amber-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-amber-400">
                <AlertTriangle size={32} className="animate-pulse" />
                <div className="text-left">
                  <p className="font-black text-lg leading-tight">NAVIGATION BLOCKED</p>
                  <p className="text-sm font-bold opacity-90">Please finish your assessment before leaving.</p>
                </div>
              </div>
            </div>
          )}

          {attendanceStatus === 'pending_evaluation' && (
            <div className="space-y-6 animate-fade-in group">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
                <Clock size={40} className="animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Evaluation in Progress</h3>
              <p className="text-slate-500 font-medium">
                Your submission is currently being evaluated by the faculty.
                <br /><br />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full inline-block mt-2">
                  Status: Pending Review
                </span>
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-slate-400 text-xs font-bold leading-relaxed">
                Please wait for your faculty to complete the evaluation. You will be able to view your results once the evaluation is finished.
              </div>
              <button
                onClick={() => navigate(`/course/${courseId}`)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                <ArrowLeft size={18} />
                Return to Course
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  if (loading || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Challenge Module...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Violation Toast Notification */}
      {showViolationToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <AlertTriangle size={24} />
            <span className="font-semibold">{violationMessage}</span>
          </div>
        </div>
      )}

      {/* LOCKED OVERLAY - Shows when test is locked due to violations */}
      {isLocked && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6"
          onContextMenu={(e) => e.preventDefault()}
          style={{ userSelect: 'none' }}
        >
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-lg w-full animate-fade-in">
            <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
              <AlertTriangle size={48} />
            </div>
            <h2 className="text-3xl font-black text-red-600 mb-4">⚠️ TEST LOCKED ⚠️</h2>
            <p className="text-slate-700 font-bold mb-4">
              Maximum security violations detected.
            </p>
            <p className="text-slate-500 text-sm mb-6">
              Your code has been automatically saved. Do NOT close this browser or navigate away.
            </p>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 text-amber-800 text-sm font-bold mb-2">
                <Clock size={18} className="animate-pulse" />
                WAITING FOR ADMINISTRATOR
              </div>
              <p className="text-amber-700 text-xs">
                An administrator will review your case and decide whether you can continue or if your work will be submitted as-is.
              </p>
            </div>
            <div className="bg-slate-100 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-500 font-mono">
                Violations: <span className="text-red-600 font-bold">{violations}</span> / {restrictions.maxViolations}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              🔒 Screen is locked • All actions are being monitored
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              {/* Back to Course button removed during active test */}
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{challenge.title}</h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-mono rounded border border-slate-200">
                  BUILD: v2.6
                </span>
              </div>
              <p className="text-gray-600">
                Level {level}{" "}
                {assignedQuestions.length > 1 &&
                  `• Question ${currentQuestionIndex + 1} of ${assignedQuestions.length
                  }`}
              </p>
            </div>

            {/* Question Navigator with Timer */}
            <div className="flex items-center gap-6">
              {/* Small Timer */}
              {timeRemaining !== null && (
                <div
                  className={`px-5 py-2.5 rounded-2xl border font-display font-black text-sm flex items-center gap-3 shadow-sm transition-all duration-300 ${timeRemaining <= 300
                    ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                    : "bg-slate-900 border-slate-800 text-white"
                    }`}
                >
                  <Clock size={18} className={timeRemaining <= 300 ? "text-rose-600" : "text-primary-400"} />
                  <span className="tracking-widest">{formatTime(timeRemaining)}</span>
                </div>
              )}

              {/* Auto-Save Status Indicator */}
              <div className="flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                {saveStatus === 'saving' && (
                  <>
                    <RefreshCw size={14} className="animate-spin text-primary-600" />
                    <span className="text-primary-600">Syncing...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-slate-500">
                      Saved {lastSaveTimestamp ? lastSaveTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <AlertTriangle size={14} className="text-rose-500" />
                    <span className="text-rose-500">Sync Failed</span>
                  </>
                )}
              </div>

              {/* Question Number Boxes */}
              {assignedQuestions.length > 1 && (
                <div className="flex gap-2">
                  {assignedQuestions.map((q, index) => {
                    const isSubmitted = userAnswers[q.id]?.submitted;
                    return (
                      <div
                        key={q.id}
                        className={`w-10 h-10 rounded flex items-center justify-center font-semibold ${index === currentQuestionIndex
                          ? "bg-blue-600 text-white ring-2 ring-blue-300"
                          : isSubmitted
                            ? "bg-green-500 text-white"
                            : "bg-gray-200 text-gray-700"
                          }`}
                        title={`Question ${index + 1} - ${isSubmitted ? "Submitted" : "Not Submitted"
                          }`}
                      >
                        {index + 1}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {allQuestionsSubmitted() && (
              <button
                onClick={handleFinishTest}
                disabled={finishingLevel}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {finishingLevel ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                {finishingLevel ? "Finishing..." : "Finish & View Results"}
              </button>
            )}
            {assignedQuestions.length > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Previous Question"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  onClick={handleNextQuestion}
                  disabled={
                    currentQuestionIndex === assignedQuestions.length - 1
                  }
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Next Question"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <button onClick={handleRunCode} className="btn-secondary">
              ▶ Run Code
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || evaluating || isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting || evaluating ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Check size={20} />
                  Submit Code
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6"
        style={{ height: "calc(100vh - 180px)" }}
      >
        {/* Left Panel: Instructions & Code Editors */}
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
          {/* Toggle Instructions Button */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center justify-between px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span className="font-semibold">
              {showInstructions
                ? "📖 Hide Instructions"
                : "📖 Show Instructions"}
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showInstructions ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Instructions */}
          {showInstructions && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 mb-4 shadow-sm">

              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                Technical Protocol
              </h2>

              <div className="mb-8 question-desc whitespace-pre-wrap">
                {challenge.description}
              </div>

              {challenge.instructions && challenge.instructions !== challenge.description && (
                <div className="border-t border-slate-100 pt-8 supporting-content whitespace-pre-wrap">
                  {challenge.instructions}
                </div>
              )}

              {/* Assets Section */}
              {challenge.assets &&
                (Array.isArray(challenge.assets)
                  ? challenge.assets.length > 0
                  : challenge.assets.images?.length > 0) && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Description
                    </h3>
                    <div className="space-y-2">
                      {(Array.isArray(challenge.assets)
                        ? challenge.assets
                        : challenge.assets?.images || []
                      ).map((asset, index) => {
                        // Normalize path
                        const assetPath =
                          typeof asset === "string" ? asset : asset.path;
                        const filename = assetPath.split("/").pop();
                        let codePath = assetPath;
                        if (!codePath.startsWith("http")) {
                          codePath = codePath.startsWith("/")
                            ? codePath.slice(1)
                            : codePath;
                          const isImage =
                            /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(codePath);
                          if (
                            isImage &&
                            !codePath.includes("images/") &&
                            !codePath.includes("assets/")
                          ) {
                            codePath = `images/${codePath}`;
                          }
                          if (!codePath.startsWith("assets/")) {
                            codePath = `assets/${codePath}`;
                          }
                          codePath = `/${codePath}`;
                        }

                        return (
                          <div
                            key={index}
                            className="bg-white p-2 rounded border border-purple-100 flex items-center justify-between"
                          >
                            <a
                              href={codePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm truncate max-w-[200px]"
                              title={filename}
                            >
                              {filename}
                            </a>
                            <code className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200 select-all">
                              {codePath}
                            </code>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Hints Section */}
              {challenge.hints && challenge.hints.length > 0 && (
                <details className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
                  <summary className="font-semibold text-yellow-900 cursor-pointer flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    💡 Hints ({challenge.hints.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {challenge.hints.map((hint, index) => (
                      <p
                        key={index}
                        className="text-sm text-yellow-800 pl-4 border-l-2 border-yellow-300"
                      >
                        {index + 1}. {hint}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Code Editors */}
          <div
            className={`flex-1 overflow-hidden rounded-lg ${isLocked ? "blur-[2px] pointer-events-none" : ""}`}
            style={
              !showInstructions ? { minHeight: "calc(100vh - 250px)" } : {}
            }
          >
            <MultiFileEditor code={code} onChange={setCode} readOnly={isLocked} />
          </div>
        </div>

        {/* Right Panel: Preview & Results */}
        <div className="flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="card flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
              <div className="p-3 border-b flex flex-wrap gap-3 items-center justify-between bg-gray-50">
                <div className="inline-flex rounded-md border bg-white p-1 shadow-sm">
                  <button
                    onClick={() => setPreviewTab("live")}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${previewTab === "live"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    Live Preview
                  </button>
                  <button
                    onClick={() => {
                      if (challenge?.expectedSolution) {
                        setPreviewTab("expected");
                      }
                    }}
                    disabled={!challenge?.expectedSolution}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${previewTab === "expected"
                      ? "bg-green-600 text-white shadow"
                      : "text-gray-600 hover:text-gray-900"
                      } ${!challenge?.expectedSolution
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                      }`}
                  >
                    Expected Result
                  </button>
                  <button
                    onClick={() => setPreviewTab("terminal")}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${previewTab === "terminal"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    Terminal
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (
                        previewTab === "expected" &&
                        !challenge?.expectedSolution
                      ) {
                        return;
                      }
                      setFullScreenView(previewTab);
                    }}
                    className="text-xs px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center gap-1"
                  >
                    ⤢ Full Screen
                  </button>
                </div>
              </div>
              <div className="flex-1 relative overflow-auto bg-gray-100">
                {previewTab === "live" ? (
                  <PreviewFrame
                    ref={previewRef}
                    code={code}
                    onConsoleLog={(logs) => setConsoleOutput(logs)}
                    isNodeJS={challenge?.challengeType === 'nodejs' || (code.js && code.js.includes('require(') && !code.html)}
                  />
                ) : previewTab === "terminal" ? (
                  <TerminalPanel
                    output={consoleOutput}
                    onClear={() => setConsoleOutput([])}
                    isExpanded={true}
                    stdin={stdin}
                    setStdin={setStdin}
                    metrics={metrics}
                  />
                ) : challenge?.expectedSolution ? (
                  <PreviewFrame
                    code={{
                      html: challenge.expectedSolution.html || "",
                      css: challenge.expectedSolution.css || "",
                      js: challenge.expectedSolution.js || "",
                    }}
                    isRestricted={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-500">
                    Expected design not available for this challenge.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results (Below Split View) */}
          {evaluating && (
            <div className="card mt-4 shrink-0 transition-all duration-300 flex flex-col max-h-[40%]">
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4"></div>
                <p className="text-lg font-black text-slate-900 tracking-tight mb-2">
                  {evaluationStep || "Evaluating..."}
                </p>
                <div className="max-w-md mx-auto text-left bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    🔄 Submission Pipeline Active
                  </p>
                  <ul className="text-xs text-slate-600 font-medium space-y-2">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                      Capturing code state
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                      Queuing for visual verification
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                      Wait for final results in summary
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Results Panel - Admin Only */}
          {result && localStorage.getItem('userRole') === 'admin' && (
            <div
              className={`card mt-4 shrink-0 transition-all duration-300 flex flex-col ${showEvaluationPanel ? "max-h-[40%]" : "max-h-14 overflow-hidden"
                }`}
            >
              <div
                className={`flex items-center justify-between ${showEvaluationPanel ? "mb-3" : "mb-0"
                  }`}
              >
                <h2 className="text-lg font-bold">Admin: Evaluation Results</h2>
                <button
                  onClick={() => setShowEvaluationPanel((prev) => !prev)}
                  className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  {showEvaluationPanel ? "Hide Panel" : "Show Panel"}
                </button>
              </div>
              {showEvaluationPanel && (
                <div className="flex-1 overflow-auto pr-2">
                  <ResultsPanel result={result} />
                </div>
              )}
            </div>
          )}
          {/* Reverted Popup Modal - Navigate directly instead */}
        </div>
      </div>
      {/* Full Screen Modal */}
      {fullScreenView && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div
            className={`p-4 border-b flex justify-between items-center ${fullScreenView === "expected" ? "bg-green-50" : "bg-gray-50"
              }`}
          >
            <h2 className="text-xl font-bold flex items-center gap-2">
              {fullScreenView === "live"
                ? "🖥️ Live Preview (Full Screen)"
                : fullScreenView === "terminal"
                  ? "🐚 Terminal Environment (Full Screen)"
                  : "✅ Expected Result (Full Screen)"}
              <span className="text-sm font-normal text-gray-500">
                {fullScreenView === "live" ? "- Your Code" : fullScreenView === "terminal" ? "- Execution Output" : "- Target Design"}
              </span>
            </h2>
            <button
              onClick={() => setFullScreenView(null)}
              className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Exit Full Screen
            </button>
          </div>
          <div className="flex-1 relative bg-gray-100 overflow-hidden p-4">
            <div className="h-full w-full bg-white shadow-xl rounded-lg overflow-hidden border">
              {fullScreenView === "live" ? (
                <PreviewFrame ref={previewRef} code={code} />
              ) : fullScreenView === "terminal" ? (
                <TerminalPanel
                  output={consoleOutput}
                  onClear={() => setConsoleOutput([])}
                  isExpanded={true}
                  stdin={stdin}
                  setStdin={setStdin}
                  metrics={metrics}
                />
              ) : (
                <PreviewFrame
                  code={{
                    html: challenge.expectedSolution.html || "",
                    css: challenge.expectedSolution.css || "",
                    js: challenge.expectedSolution.js || "",
                  }}
                  isRestricted={true}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
