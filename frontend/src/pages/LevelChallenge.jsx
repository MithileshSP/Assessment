import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, CheckCircle, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Check, Layout, Star, ChevronUp, ChevronDown, Eye, Maximize2, X, Shield } from "lucide-react";
import ToastContainer from "../components/Toast";
import MultiFileEditor from "../components/MultiFileEditor";
import TerminalPanel from "../components/TerminalPanel";
import PreviewFrame from "../components/PreviewFrame";
import ResultsPanel from "../components/ResultsPanel";
import api from "../services/api";

export default function LevelChallenge() {
  const { levelId, courseId: oldCourseId, level: levelParam } = useParams();
  const courseId = levelId || oldCourseId;
  const level = levelParam || 1;
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
  const expectedResultCode = useMemo(() => ({
    html: challenge?.expectedHtml || "",
    css: challenge?.expectedCss || "",
    js: challenge?.expectedJs || ""
  }), [challenge?.expectedHtml, challenge?.expectedCss, challenge?.expectedJs]);

  const [restrictions, setRestrictions] = useState({
    blockCopy: false,
    blockPaste: false,
    forceFullscreen: false,
    maxViolations: 10,
    timeLimit: 0,
  });
  const [violations, setViolations] = useState(0);
  const [violationBreakdown, setViolationBreakdown] = useState({
    copy: 0,
    paste: 0,
    fullscreenExit: 0,
    tabSwitch: 0,
    devtools: 0
  });
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [lastViolationTime, setLastViolationTime] = useState(0);

  // Toast State
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const previewRef = useRef(null);
  const fullPreviewRef = useRef(null);
  const monacoRef = useRef(null);
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

  // Resize State
  const [leftWidth, setLeftWidth] = useState(58); // Percentage
  const [isResizing, setIsResizing] = useState(false);

  // Preview History State
  const [previewHistory, setPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
  const [fullPreviewHistory, setFullPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
  const [securityAck, setSecurityChecks] = useState({ 0: false, 1: false, 2: false, 3: false, 4: false });

  const allChecksPassed = Object.values(securityAck).every(Boolean);

  const toggleCheck = (index) => {
    setSecurityChecks(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const startResizing = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setLeftWidth(newWidth);
      }
    };

    const stopResizing = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none'; // Prevent any clicks while dragging
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      document.body.style.pointerEvents = 'auto';
    };
  }, [isResizing]);

  // Refs for stale closure prevention in Timer interval
  const assignedQuestionsRef = useRef(assignedQuestions);
  const userAnswersRef = useRef(userAnswers);
  const codeRef = useRef(code);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);

  // Sync refs with state
  useEffect(() => {
    assignedQuestionsRef.current = assignedQuestions;
    userAnswersRef.current = userAnswers;
    codeRef.current = code;
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [assignedQuestions, userAnswers, code, currentQuestionIndex]);

  useEffect(() => {
    if (assignedQuestions.length > 0) {
      loadCurrentQuestion();
    }
  }, [currentQuestionIndex, assignedQuestions]);

  // Check Attendance and Restrictions on Mount
  useEffect(() => {
    if (courseId && level) {
      checkAttendance();
      loadRestrictions();
    }
    return () => {
      if (attendanceTimer) clearInterval(attendanceTimer);
      if (unlockPollRef.current) clearInterval(unlockPollRef.current);
    };
  }, [courseId, level]);

  useEffect(() => {
    if (consoleOutput.length > 0) {
      console.log(`[UI Terminal] Received ${consoleOutput.length} lines. Latest:`, consoleOutput[consoleOutput.length - 1].content);
    }
  }, [consoleOutput]);

  const checkAttendance = async () => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      setAttendanceStatus('started');
      loadLevelQuestions(); // ADMIN FIX
      loadRestrictions();
      return;
    }

    try {
      const res = await api.get('/attendance/status', { params: { courseId, level } });
      const { status, session, isUsed, locked, isBlocked, isCleared } = res.data;

      if (isCleared) {
        setAttendanceStatus('cleared');
        setLoading(false);
        return;
      }

      if (isBlocked) {
        setAttendanceStatus('blocked');
        setLoading(false);
        return;
      }

      if (locked) {
        setAttendanceStatus('started');
        loadLevelQuestions(); // LOCKED FIX
        setLoading(false);
        setTimeout(() => handleLockTest(restrictions.maxViolations || 3), 100);
        return;
      }

      /*
      if (isUsed) {
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
      */

      setAttendanceStatus(status);
      if (res.data.studentDetails) {
        setStudentInfo(res.data.studentDetails);
      }

      if (session) {
        const clientNow = Date.now();
        const serverNow = session.server_time_ms || new Date(session.server_time).getTime();
        const endTime = new Date(session.end_time).getTime();
        clockOffsetRef.current = serverNow - clientNow;
        sessionEndTimeRef.current = endTime;
        const correctedNow = clientNow + clockOffsetRef.current;
        const remaining = Math.max(0, Math.floor((endTime - correctedNow) / 1000));
        setTimeRemaining(remaining);
        setRestrictions(prev => ({ ...prev, timeLimit: session.duration_minutes }));
      }

      const sessionRes = await api.post("/test-sessions", {
        user_id: userId,
        course_id: courseId,
        level: parseInt(level),
      });

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

      if (!isBlocked) {
        setAttendanceStatus('approved');
        if (!session && !sessionEndTimeRef.current && restrictions.timeLimit > 0) {
          const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
          const durationMs = restrictions.timeLimit * 60 * 1000;
          const endTime = startTime + durationMs;
          sessionEndTimeRef.current = endTime;
          clockOffsetRef.current = 0;
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setTimeRemaining(remaining);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Attendance check failed", error);
      setAttendanceStatus('none');
      setLoading(false);
    }
  };

  const startTest = () => {
    loadLevelQuestions();
    loadRestrictions();
    setAttendanceStatus('started');
    if (restrictions.forceFullscreen) {
      document.documentElement.requestFullscreen?.().catch((err) => {
        console.warn('Initial fullscreen request failed:', err.message);
      });
    }
  };

  const loadLevelQuestions = async () => {
    try {
      setLoading(true); // LOADING FIX
      const response = await api.get(`/challenges/level-questions`, {
        params: { userId, courseId, level: parseInt(level) },
      });

      let questions = response.data.assignedQuestions || [];

      if (questions.length === 0) {
        // alert("No questions assigned for this level");
        // navigate(`/course/${courseId}`);
        setLoading(false);
        return;
      }

      const storageKey = `assessment_${userId}_${courseId}_${level}`;
      const savedState = localStorage.getItem(storageKey);

      if (savedState) {
        try {
          const { questions: savedQs, answers, currentIndex, code: savedCode } = JSON.parse(savedState);
          const apiQuestionIds = questions.map(q => q.id).sort().join(',');
          const savedQuestionIds = savedQs.map(q => q.id).sort().join(',');

          if (apiQuestionIds === savedQuestionIds) {
            setAssignedQuestions(savedQs);
            setUserAnswers(answers);
            setCurrentQuestionIndex(currentIndex);
            setCode(savedCode);
            setLoading(false);
            return;
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          console.error("Failed to restore state", e);
          localStorage.removeItem(storageKey);
        }
      }

      setAssignedQuestions(questions);
      const initialAnswers = {};
      questions.forEach((q) => {
        initialAnswers[q.id] = {
          html: "", css: "", js: "", additionalFiles: {}, submitted: false, result: null,
        };
      });
      setUserAnswers(initialAnswers);
      await createTestSession();

      try {
        const restrictionsRes = await api.get(`/courses/${courseId}/restrictions`);
        if (restrictionsRes.data) {
          setRestrictions(prev => ({ ...prev, ...restrictionsRes.data }));
        }
      } catch (e) {
        console.warn('Failed to load restrictions:', e.message);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to load level questions:", error);
      setLoading(false);
    }
  };

  const createTestSession = async () => {
    try {
      const response = await api.post("/test-sessions", {
        user_id: userId, course_id: courseId, level: parseInt(level),
      });
      setTestSessionId(response.data.id);
      if (response.data.started_at) setStartedAt(response.data.started_at);
    } catch (error) {
      console.error("Failed to sync session:", error);
    }
  };

  useEffect(() => {
    if (assignedQuestions.length > 0 && assignedQuestions[currentQuestionIndex]) {
      const currentQId = assignedQuestions[currentQuestionIndex].id;
      setDirtyQuestions(prev => new Set(prev).add(currentQId));
      const storageKey = `assessment_${userId}_${courseId}_${level}`;
      localStorage.setItem(storageKey, JSON.stringify({
        questions: assignedQuestions,
        answers: { ...userAnswers, [currentQId]: { ...userAnswers[currentQId], ...code } },
        currentIndex: currentQuestionIndex,
        code
      }));
    }
  }, [code]);

  useEffect(() => {
    if (assignedQuestions[currentQuestionIndex]) {
      setUserAnswers(prev => ({
        ...prev,
        [assignedQuestions[currentQuestionIndex].id]: {
          ...prev[assignedQuestions[currentQuestionIndex].id],
          html: code.html, css: code.css, js: code.js
        }
      }));
    }
  }, [code, currentQuestionIndex, assignedQuestions]);

  const loadCurrentQuestion = async () => {
    if (!assignedQuestions[currentQuestionIndex]) return;
    const questionId = assignedQuestions[currentQuestionIndex].id;
    try {
      const response = await api.get(`/challenges/${questionId}`);
      const challengeData = response.data;
      setChallenge(challengeData);
      setPreviewTab(challengeData.challengeType === 'nodejs' ? "terminal" : "live");
      const savedAnswer = userAnswers[questionId];
      if (savedAnswer && (savedAnswer.html || savedAnswer.css || savedAnswer.js)) {
        setCode({
          html: savedAnswer.html, css: savedAnswer.css, js: savedAnswer.js,
          additionalFiles: savedAnswer.additionalFiles || {},
        });
        setResult(savedAnswer.result);
      } else {
        // Initialize from challenge data if no saved answer
        // If empty, provide simple placeholder comments
        const starterHtml = challengeData.html || `<!-- Enter your HTML code here -->`;
        const starterCss = challengeData.css || `/* Enter your CSS styles here */`;
        const starterJs = challengeData.js || `// Enter your JavaScript code here`;
        setCode({
          html: starterHtml,
          css: starterCss,
          js: starterJs,
          additionalFiles: challengeData.additionalFiles || (typeof challengeData.assets === 'object' ? {} : JSON.parse(challengeData.additional_files || '{}'))
        });
      }
    } catch (error) {
      console.error("Failed to load question:", error);
    }
  };

  const loadRestrictions = async () => {
    try {
      const response = await api.get(`/courses/${courseId}/restrictions`);
      if (response.data) {
        setRestrictions(prev => ({ ...prev, ...response.data }));
        if (response.data.timeLimit > 0 && timeRemaining === null) {
          const durationSeconds = response.data.timeLimit * 60;
          setTimeRemaining(durationSeconds);
          if (sessionEndTimeRef.current === null) {
            sessionEndTimeRef.current = Date.now() + durationSeconds * 1000;
          }
        }
      }
    } catch (error) {
      console.error("Failed to load restrictions:", error);
    }
  };

  // Real-time Status Polling: Auto-refresh when waiting for admin action
  useEffect(() => {
    let pollInterval;
    // States where we want to poll for updates (e.g. waiting for approval, unlock)
    const waitingStates = ['none', 'requested', 'rejected', 'blocked', 'cleared', 'loading', 'pending_evaluation'];

    if (waitingStates.includes(attendanceStatus)) {
      pollInterval = setInterval(() => {
        // We call checkAttendance to refresh the status
        // Note: checkAttendance handles all logic including session updates
        checkAttendance();
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [attendanceStatus, courseId, level]); // Re-setup if status changes

  useEffect(() => {
    const syncWithServer = async () => {
      if (attendanceStatus === 'approved' || attendanceStatus === 'started') {
        try {
          const res = await api.get('/attendance/status', { params: { courseId, level } });
          const { session } = res.data;
          if (session) {
            const clientNow = Date.now();
            const serverNow = session.server_time_ms || new Date(session.server_time).getTime();
            const endTime = new Date(session.end_time).getTime();
            clockOffsetRef.current = serverNow - clientNow;
            sessionEndTimeRef.current = endTime;
            const correctedNow = clientNow + clockOffsetRef.current;
            const remaining = Math.max(0, Math.floor((endTime - correctedNow) / 1000));
            setTimeRemaining(remaining);
            if (session.is_expired || remaining <= 0) handleFinishLevel({ reason: "timeout" });
          }
        } catch (err) { }
      }
    };
    syncWithServer();
    const syncTimer = setInterval(syncWithServer, 30000);
    return () => clearInterval(syncTimer);
  }, [attendanceStatus, courseId, level]);

  useEffect(() => {
    if (attendanceStatus !== 'started') return; // Continue even if isLocked (server side status)
    const interval = setInterval(() => {
      let remaining = 0;
      if (sessionEndTimeRef.current !== null) {
        const correctedNow = Date.now() + (clockOffsetRef.current || 0);
        remaining = Math.max(0, Math.floor((sessionEndTimeRef.current - correctedNow) / 1000));
        setTimeRemaining(remaining);
      } else if (timeRemaining !== null && timeRemaining > 0) {
        setTimeRemaining(prev => { remaining = Math.max(0, (prev || 0) - 1); return remaining; });
      }
      if (remaining <= 0 && (sessionEndTimeRef.current !== null || (timeRemaining !== null && timeRemaining <= 0))) {
        clearInterval(interval);
        handleFinishLevel({ reason: "timeout" });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [attendanceStatus, sessionEndTimeRef.current]);

  const formatTime = (seconds) => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleViolation = (type) => {
    const now = Date.now();
    if (now - lastViolationTime < 2000) return;
    setLastViolationTime(now);

    // Update total count
    const newViolations = violations + 1;
    setViolations(newViolations);

    // Update breakdown
    setViolationBreakdown(prev => {
      const next = { ...prev };
      if (type.toLowerCase().includes('copy')) next.copy++;
      else if (type.toLowerCase().includes('paste')) next.paste++;
      else if (type.toLowerCase().includes('fullscreen')) next.fullscreenExit++;
      else if (type.toLowerCase().includes('switch')) next.tabSwitch++;
      else if (type.toLowerCase().includes('devtools')) next.devtools++;
      return next;
    });

    addToast(`${type}`, 'error');
    if (newViolations >= restrictions.maxViolations && !isLocked) handleLockTest(newViolations);
  };

  const unlockPollRef = useRef(null);

  const handleLockTest = async (violationCount) => {
    setIsLocked(true);
    addToast("Maximum violations reached. Test locked.", 'error');
    const capturedAnswers = { ...userAnswers };
    if (challenge) {
      capturedAnswers[challenge.id] = { html: code.html, css: code.css, js: code.js, additionalFiles: code.additionalFiles };
    }
    lockedCodeRef.current = capturedAnswers;
    if (challenge) {
      setUserAnswers(prev => ({ ...prev, [challenge.id]: capturedAnswers[challenge.id] }));
      setDirtyQuestions(prev => new Set(prev).add(challenge.id));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    await autoSaveBatch();
    try {
      await api.post('/attendance/lock', {
        courseId,
        level: parseInt(level),
        reason: 'Max violations reached',
        violationCount,
        breakdown: violationBreakdown
      });
    } catch (err) { }
    if (unlockPollRef.current) clearInterval(unlockPollRef.current);
    unlockPollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/attendance/status', { params: { courseId, level } });
        // console.log('[Lock Poll] Status:', res.data); // DEBUG
        if (res.data && res.data.locked === false) {
          // console.log('[Lock Poll] Unlocked. Action:', res.data.unlockAction, 'isUsed:', res.data.isUsed); // DEBUG
          clearInterval(unlockPollRef.current);
          unlockPollRef.current = null;

          // CRITICAL FIX: If action is explicitly 'continue', prioritize it over 'isUsed'
          // This handles cases where isUsed might be true (e.g., from a previous finish) but admin wants to allow retry.
          if (res.data.unlockAction === 'continue') {
            // console.log('[Lock Poll] Continuing test (Override). Resetting violations.'); // DEBUG
            setIsLocked(false);
            setViolations(0);
            setLastViolationTime(Date.now());
            return;
          }

          if (res.data.unlockAction === 'submit' || res.data.isUsed) {
            // console.log('[Lock Poll] Finishing test.'); // DEBUG
            setIsLocked(false);
            handleFinishTest({ reason: "admin_forced" });
          } else {
            // console.log('[Lock Poll] Continuing test. Resetting violations.'); // DEBUG
            // Default to continue if unlocked (manual/fallback unlocks)
            setIsLocked(false);
            setViolations(0);
            setLastViolationTime(Date.now());
          }
        }
      } catch (e) { }
    }, 3000);
  };

  const autoSaveBatch = async () => {
    if (dirtyQuestions.size === 0 || isSaving) return;
    setIsSaving(true); setSaveStatus('saving');
    try {
      const submissionsToSave = [];
      dirtyQuestions.forEach(qId => {
        let qCode = (assignedQuestions[currentQuestionIndex]?.id === qId) ? code : {
          html: userAnswers[qId]?.html || '', css: userAnswers[qId]?.css || '', js: userAnswers[qId]?.js || ''
        };
        if (qCode.html || qCode.css || qCode.js) submissionsToSave.push({ challengeId: qId, userId, code: qCode, candidateName: localStorage.getItem('fullName') || 'Student' });
      });
      if (submissionsToSave.length > 0) {
        await api.post('/submissions/batch', { submissions: submissionsToSave, courseId, level: parseInt(level) });
      }
      setDirtyQuestions(new Set()); setSaveStatus('saved'); setLastSaveTimestamp(new Date());
    } catch (err) {
      setSaveStatus('error');
    } finally { setIsSaving(false); }
  };

  useEffect(() => {
    if (attendanceStatus !== 'started') return;
    const timer = setInterval(() => autoSaveBatch(), 30000);
    return () => clearInterval(timer);
  }, [dirtyQuestions, userAnswers, code, attendanceStatus]);

  const handleFinishLevel = async ({ reason = "manual", forceSubmissionId = null } = {}) => {
    if (finishingLevel && reason !== "timeout") return;
    if (reason === "timeout") setFinishingLevel(true);
    autoSaveBatch().catch(() => { });
    handleFinishTest({ reason, forceSubmissionId });
  };

  const handleFinishTest = async ({ reason = "manual", forceSubmissionId = null } = {}) => {
    // console.log('[handleFinishTest] Called with reason:', reason); // DEBUG
    setFinishingLevel(true);
    let lastSubmissionId = forceSubmissionId;
    if (reason === "timeout") setEvaluationStep("Time expired. Submitting your work...");
    else if (reason === "admin_forced") setEvaluationStep("Session ended by admin. Submitting work...");

    try {
      let questionsToSubmit = assignedQuestionsRef.current;
      if (!questionsToSubmit || questionsToSubmit.length === 0) {
        questionsToSubmit = Object.keys(userAnswersRef.current).map(id => ({ id }));
      }
      const codeSource = (reason === 'admin_forced' && lockedCodeRef.current) ? lockedCodeRef.current : userAnswersRef.current;
      const submissionRequests = questionsToSubmit.map(async (question) => {
        const savedAnswer = codeSource[question.id];
        const isCurrent = reason !== 'admin_forced' && assignedQuestionsRef.current[currentQuestionIndexRef.current]?.id === question.id;
        let c = isCurrent && codeRef.current ? codeRef.current : {
          html: savedAnswer?.html || '', css: savedAnswer?.css || '', js: savedAnswer?.js || '', additionalFiles: savedAnswer?.additionalFiles || {}
        };
        if (reason === "timeout" && !c.html && !c.js) c.js = "// Automatic submission on timeout";
        if (c.html || c.js || reason === "timeout") {
          try {
            const r = await api.post("/submissions", { challengeId: question.id, userId: userId, code: c, isFinal: true });
            const sId = r.data.submissionId;
            if (testSessionId && sId) await api.post(`/test-sessions/${testSessionId}/submissions`, { submission_id: sId });
            return sId;
          } catch (e) { return null; }
        }
        return null;
      });
      const results = await Promise.all(submissionRequests);
      const successful = results.filter(id => id);
      if (successful.length > 0) lastSubmissionId = successful[successful.length - 1];
      if (testSessionId) {
        let msg = reason === "violations" ? "Violations" : (reason === "timeout" ? "Timeout" : "Manual");
        await api.put(`/test-sessions/${testSessionId}/complete`, { user_feedback: msg });
      }
      localStorage.removeItem(`assessment_${userId}_${courseId}_${level}`);
      if (lastSubmissionId) { navigate(`/student/feedback/${lastSubmissionId}`); return; }
      navigate(`/course/${courseId}`);
    } catch (error) { navigate(`/course/${courseId}`); }
    finally { setFinishingLevel(false); setEvaluationStep(""); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    if ((!code.html || !code.html.trim()) && (!code.js || !code.js.trim())) {
      addToast("Please write some code.", "error"); setSubmitting(false); return;
    }
    setUserAnswers(prev => ({ ...prev, [challenge.id]: { ...prev[challenge.id], html: code.html, css: code.css, js: code.js, submitted: true, result: { status: 'saved' } } }));
    setSubmitting(false);
  };

  useEffect(() => {
    if (!restrictions.blockCopy && !restrictions.blockPaste && !restrictions.forceFullscreen) return;
    const hc = (e) => { if (restrictions.blockCopy) { e.preventDefault(); handleViolation("Copy blocked"); } };
    const hp = (e) => { if (restrictions.blockPaste) { e.preventDefault(); handleViolation("Paste blocked"); } };
    const hk = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))) { e.preventDefault(); handleViolation("DevTools Blocked"); }
    };
    const hv = () => { if (document.hidden && restrictions.forceFullscreen) handleViolation("Window Switch Detected"); };
    const hf = () => { if (restrictions.forceFullscreen && !document.fullscreenElement && violations < restrictions.maxViolations) handleViolation("Fullscreen Exit Attempted"); };
    document.addEventListener("copy", hc, { capture: true });
    document.addEventListener("paste", hp, { capture: true });
    document.addEventListener("keydown", hk, { capture: true });
    if (restrictions.forceFullscreen) {
      document.addEventListener("visibilitychange", hv);
      document.addEventListener("fullscreenchange", hf);
    }
    return () => {
      document.removeEventListener("copy", hc, { capture: true });
      document.removeEventListener("paste", hp, { capture: true });
      document.removeEventListener("keydown", hk, { capture: true });
      document.removeEventListener("visibilitychange", hv);
      document.removeEventListener("fullscreenchange", hf);
    };
  }, [restrictions, violations, lastViolationTime, isLocked]);

  useEffect(() => {
    if (attendanceStatus !== 'started') return;
    window.history.pushState({ testInProgress: true }, '', window.location.href);
    const hp = () => { window.history.pushState({ testInProgress: true }, '', window.location.href); setShowNavWarning(true); setTimeout(() => setShowNavWarning(false), 4000); };
    const hb = (e) => { e.preventDefault(); e.returnValue = "Assessment in progress!"; return "Assessment in progress!"; };
    window.addEventListener('popstate', hp);
    window.addEventListener('beforeunload', hb);
    return () => { window.removeEventListener('popstate', hp); window.removeEventListener('beforeunload', hb); };
  }, [attendanceStatus]);

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setUserAnswers(prev => ({ ...prev, [assignedQuestions[currentQuestionIndex].id]: { ...prev[assignedQuestions[currentQuestionIndex].id], html: code.html, css: code.css, js: code.js } }));
      setCurrentQuestionIndex(currentQuestionIndex - 1); setPreviewTab("live");
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < assignedQuestions.length - 1) {
      setUserAnswers(prev => ({ ...prev, [assignedQuestions[currentQuestionIndex].id]: { ...prev[assignedQuestions[currentQuestionIndex].id], html: code.html, css: code.css, js: code.js } }));
      setCurrentQuestionIndex(currentQuestionIndex + 1); setPreviewTab("live");
    }
  };

  const handleRunCode = async () => {
    setConsoleOutput([]); // Clear previous output
    const isNodeJS = challenge?.challengeType === 'nodejs';
    if (isNodeJS) {
      setEvaluating(true); setPreviewTab("terminal");
      try {
        const r = await api.executeCode(code.js, code.additionalFiles || {}, 'nodejs', stdin);
        setConsoleOutput((r.data.output || '').split('\n').map(l => ({ type: 'log', content: l })));
      } catch (e) { setConsoleOutput([{ type: 'error', content: e.message }]); }
      finally { setEvaluating(false); }
    } else {
      // For Web challenges, stay on current tab (Live Preview) but update it
      previewRef.current?.updatePreview(code);
    }
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
      <div className="bg-[#f5f6f8] min-h-screen flex items-center justify-center p-4 font-display">
        <div className="max-w-[960px] w-full bg-white border border-[#e5e7eb] rounded-[6px] p-10 shadow-sm">

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-12">
            <div className="w-12 h-12 flex items-center justify-center border border-[#e5e7eb] rounded-[6px] mb-6 bg-white">
              <Shield className="text-slate-700" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Assessment Security Checkpoint</h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">Please confirm your identity and agree to the assessment guidelines before proceeding.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

            {/* Left Column: Candidate Info */}
            <div className="space-y-8">
              <div>
                <span className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase block mb-4">Candidate Information</span>
                <div className="border border-[#e5e7eb] rounded-[6px] p-6 space-y-5 bg-white">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Fullname</span>
                    <p className="text-lg font-bold text-slate-900 leading-none">
                      {studentInfo?.fullName || localStorage.getItem('fullName') || 'Unknown Candidate'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Roll Number</span>
                    <p className="text-lg font-bold text-slate-900 leading-none tracking-tight">
                      {studentInfo?.rollNo || 'N/A'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-2">Authorized Course</span>
                    <span className="inline-block px-3 py-1.5 border border-[#e5e7eb] text-xs font-semibold text-slate-700 rounded-[6px] bg-slate-50">
                      {studentInfo?.courseTitle || 'Technical Assessment'}
                    </span>
                  </div>
                </div>
              </div>

              <button onClick={() => navigate("/")} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={18} className="mr-2" />
                Back to Dashboard
              </button>
            </div>

            {/* Right Column: Instructions & Actions */}
            <div className="flex flex-col">
              <div className="flex-grow">
                <span className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase block mb-4">Assessment Instructions</span>

                {/* Status Messages for non-actionable states */}
                {attendanceStatus === 'blocked' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm mb-4">
                    <strong>Access Restricted:</strong> Please wait for instructor authorization.
                  </div>
                )}
                {attendanceStatus === 'used' && (
                  <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-sm mb-4">
                    <strong>Attempt Exhausted:</strong> You have already submitted this assessment.
                  </div>
                )}
                {attendanceStatus === 'cleared' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm mb-4">
                    <strong>Level Cleared:</strong> You have successfully passed this level!
                  </div>
                )}

                {/* Checklist (Only show if approved/admin/started possibilities) */}
                {(attendanceStatus === 'approved' || attendanceStatus === 'none' || localStorage.getItem('userRole') === 'admin') && (
                  <div className="space-y-4 mb-8">
                    {[
                      "I will not open developer tools",
                      "I will not switch tabs during the assessment",
                      "I will not copy or paste content",
                      "I understand the test auto-submits on violation",
                      "I agree to follow all integrity rules"
                    ].map((label, idx) => (
                      <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={securityAck[idx]}
                          onChange={() => toggleCheck(idx)}
                          className="mt-0.5 w-4 h-4 border-[#e5e7eb] rounded-[4px] text-slate-900 focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors select-none">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-6 border-t border-[#e5e7eb]">
                {(attendanceStatus === 'approved' || attendanceStatus === 'none' || localStorage.getItem('userRole') === 'admin') ? (
                  <>
                    <button
                      onClick={startTest}
                      disabled={!allChecksPassed}
                      className={`w-full py-3 px-8 rounded-[6px] flex items-center justify-center gap-2 transition-all font-semibold ${allChecksPassed
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-md transform active:scale-[0.98]"
                        : "bg-[#d1d5db] text-white cursor-not-allowed"
                        }`}
                    >
                      Start Assessment
                      <ArrowLeft className="rotate-180" size={18} />
                    </button>
                    {!allChecksPassed && (
                      <p className="text-[10px] text-center text-slate-400 mt-3 italic">Button enables after checking all instructions</p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => navigate("/")}
                    className="w-full py-3 px-8 bg-white border border-slate-200 text-slate-700 rounded-[6px] font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Return to Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Challenge...</p>
      </div>
    );
  }




  return (
    <div
      className="min-h-screen bg-gray-50 select-none"
      onContextMenu={(e) => {
        if (attendanceStatus === 'started' && !isLocked) {
          e.preventDefault();
        }
      }}
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className={`px-3 py-2 rounded-md transition-all flex items-center gap-2 ${showInstructions ? 'bg-slate-100 text-slate-900 border' : 'bg-slate-900 text-white shadow-md'}`}
            title={showInstructions ? "Hide Instructions" : "Show Instructions"}
          >
            <Layout size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{showInstructions ? 'Hide Task' : 'Show Task'}</span>
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{challenge.title}</h1>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-mono rounded border underline decoration-slate-300">BUILD: v3.4.16-stable</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Level {level} • Question {currentQuestionIndex + 1} / {assignedQuestions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {timeRemaining !== null && (
            <div className={`px-4 py-1.5 rounded-md border font-bold text-sm flex items-center gap-2 transition-colors ${timeRemaining <= 300 ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-slate-900 text-white"}`}>
              <Clock size={16} /> <span>{formatTime(timeRemaining)}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-md text-[9px] font-bold uppercase tracking-wider">
            <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-slate-500">{saveStatus === 'saving' ? 'Syncing' : 'Saved'}</span>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {assignedQuestions.length > 1 && (
            <div className="flex gap-1">
              <button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0} className="p-1.5 border rounded-md hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={18} /></button>
              <button onClick={handleNextQuestion} disabled={currentQuestionIndex === assignedQuestions.length - 1} className="p-1.5 border rounded-md hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={18} /></button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={handleRunCode} className="px-3 py-1.5 bg-slate-100 rounded-md hover:bg-slate-200 font-bold text-xs flex items-center gap-2">
              <RefreshCw size={14} /> Run
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-bold text-xs">
              Submit
            </button>
            {assignedQuestions.every(q => userAnswers[q.id]?.submitted) && (
              <button onClick={() => handleFinishLevel({ reason: "manual" })} className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-bold text-xs flex items-center gap-1">
                <CheckCircle size={14} /> Finish
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex gap-0 p-3 overflow-hidden bg-slate-50" style={{ height: "calc(100vh - 61px)" }}>
        {/* Left Column: Instructions & Editor */}
        <div style={{ width: `${leftWidth}%` }} className="flex flex-col gap-3 min-w-0 pr-1 select-none">
          {showInstructions && (
            <div className={`flex-[0.6] bg-white rounded-md border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[150px] transition-all`}>
              <div className="px-4 py-2 border-b flex items-center justify-between bg-slate-50/50 shrink-0">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Task Details</h2>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                  title="Hide Instructions"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto leading-relaxed scroll-smooth">
                <div className="question-desc text-slate-700 text-base font-medium mb-4 break-words whitespace-pre-wrap leading-relaxed">{challenge.description}</div>
                {challenge.instructions && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Technical Guidance</h3>
                    <div className="text-sm text-slate-500 italic space-y-2 whitespace-pre-wrap leading-relaxed">{challenge.instructions}</div>
                  </div>
                )}
                {/* Asset Path Helper */}
                {(() => {
                  const assetList = Array.isArray(challenge.assets)
                    ? challenge.assets
                    : (challenge.assets?.images || []);

                  if (assetList.length === 0) return null;

                  return (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Asset Paths</h3>
                      <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                        <p className="text-[10px] text-slate-500 mb-2">To use images or assets in your code, use these paths:</p>
                        {assetList.map((assetItem, idx) => {
                          const pathStr = typeof assetItem === 'string' ? assetItem : (assetItem?.path || '');
                          if (!pathStr) return null;
                          return (
                            <code key={idx} className="block font-mono text-xs bg-white px-2 py-1 rounded border text-indigo-600 mb-1 break-all select-all cursor-pointer hover:bg-slate-50" title="Click to copy" onClick={() => navigator.clipboard.writeText(pathStr)}>{pathStr}</code>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          <div className="flex-1 bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <MultiFileEditor code={code} onChange={setCode} readOnly={isLocked} />
          </div>
        </div>

        {/* Drag Handle */}
        <div
          onMouseDown={startResizing}
          className={`relative w-2 group cursor-col-resize flex items-center justify-center transition-all z-30 ${isResizing ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
          style={{ pointerEvents: 'auto' }}
        >
          <div className={`w-0.5 h-10 rounded-full transition-all ${isResizing ? 'bg-slate-900 h-20 w-[3px]' : 'bg-slate-300 group-hover:bg-slate-500'}`} />

          {/* Invisible Overlay to capture mouse events when dragging (STOPS IFRAME FROM STEALING FOCUS) */}
          {isResizing && (
            <div className="fixed inset-0 z-[9999] cursor-col-resize pointer-events-auto" style={{ background: 'transparent' }} />
          )}
        </div>

        {/* Right Column: Preview/Terminal */}
        <div style={{ width: `${100 - leftWidth}%` }} className="flex flex-col min-w-0 gap-3 pl-1">
          <div className="flex-1 bg-white rounded-md border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="h-10 border-b flex items-center justify-between bg-slate-50 px-2 shrink-0">
              <div className="flex gap-1 h-full">
                <button
                  onClick={() => setPreviewTab("live")}
                  className={`px-3 py-1 text-[10px] font-bold transition-all flex items-center gap-1.5 border-b-2 ${previewTab === 'live' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  <Layout size={12} /> Live Preview
                </button>
                {(challenge.expectedHtml || challenge.expectedCss || challenge.expectedJs || (challenge.assets && challenge.assets.reference)) && (
                  <button
                    onClick={() => setPreviewTab("expected")}
                    className={`px-3 py-1 text-[10px] font-bold transition-all flex items-center gap-1.5 border-b-2 ${previewTab === 'expected' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <Eye size={12} /> Expected Result
                  </button>
                )}
                <button
                  onClick={() => setPreviewTab("terminal")}
                  className={`px-3 py-1 text-[10px] font-bold transition-all flex items-center gap-1.5 border-b-2 ${previewTab === 'terminal' ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  <RefreshCw size={12} /> Execution Output
                </button>
              </div>
              <button
                onClick={() => setFullScreenView(previewTab)}
                className="p-1 px-2 text-slate-400 hover:text-slate-900 transition-all rounded"
                title="Fullscreen"
              >
                <Maximize2 size={12} />
              </button>
            </div>

            <div className="flex-1 bg-white relative overflow-hidden">
              <div className={previewTab === 'live' ? 'h-full w-full overflow-hidden' : 'hidden'}>
                <PreviewFrame
                  ref={previewRef}
                  code={code}
                  isNodeJS={challenge?.challengeType === 'nodejs'}
                  onConsoleLog={setConsoleOutput}
                  onHistoryChange={setPreviewHistory}
                  stdin={stdin}
                />
              </div>

              {previewTab === 'expected' && (
                <div className="w-full h-full p-4 overflow-auto flex items-center justify-center bg-slate-50">
                  {challenge.assets?.reference ? (
                    <img
                      src={challenge.assets.reference}
                      alt="Expected Reference"
                      className="max-w-full shadow-lg rounded border"
                      onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50" fill="gray">No Reference</text></svg>' }}
                    />
                  ) : (challenge.expectedHtml || challenge.expectedCss || challenge.expectedJs) ? (
                    <PreviewFrame
                      autoRun={true}
                      code={expectedResultCode}
                    />
                  ) : (
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No expected output</p>
                  )}
                </div>
              )}

              {previewTab === 'terminal' && (
                <TerminalPanel
                  output={consoleOutput}
                  onClear={() => setConsoleOutput([])}
                  isExpanded={true}
                  stdin={stdin}
                  setStdin={setStdin}
                  metrics={metrics}
                />
              )}
            </div>
          </div>
          {evaluating && <div className="p-4 bg-slate-900 text-white rounded-md animate-pulse flex items-center gap-3"><RefreshCw className="animate-spin" size={16} /> <span className="font-bold text-xs uppercase tracking-wider">Evaluating Submission...</span></div>}
          {result && localStorage.getItem('userRole') === 'admin' && <div className="h-48 overflow-auto border rounded-md p-4 bg-white shadow-inner"><ResultsPanel result={result} /></div>}
        </div>
      </main>

      {/* Violation Locking Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] p-12 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-10 border border-rose-100">
              <Shield size={48} className="text-rose-600 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Security Lockdown</h2>
            <p className="text-slate-500 font-bold mb-10 leading-relaxed text-lg">
              Maximum security violations reached. Your session has been frozen for review.
            </p>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col gap-4 text-left mb-10">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Status</span>
                <span className="text-[10px] font-black uppercase text-rose-600 px-2 py-1 bg-rose-50 rounded-lg">Frozen</span>
              </div>
              <div className="h-px bg-slate-200/60" />
              <p className="text-xs text-slate-500 font-medium">Please inform the instructor or supervisor to authorize a session resume or final submission.</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce [animation-delay:0.4s]" />
            </div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-8 italic">Monitoring authorization node...</p>
          </div>
        </div>
      )}

      {/* Fullscreen Required Overlay */}
      {restrictions.forceFullscreen && !document.fullscreenElement && !isLocked && attendanceStatus === 'started' && (
        <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <Maximize2 size={36} className="text-indigo-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Full-Screen Required</h2>
            <p className="text-slate-500 font-bold mb-10 px-4">
              To proceed with the assessment, you must enter full-screen mode and maintain focus.
            </p>
            <button
              onClick={() => {
                document.documentElement.requestFullscreen?.().catch((err) => {
                  addToast("Browser blocked fullscreen request. Please click anywhere and try again.", "error");
                });
              }}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3"
            >
              Resume in Fullscreen <ArrowLeft className="rotate-180" size={18} />
            </button>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-8">Exiting fullscreen will trigger a violation record.</p>
          </div>
        </div>
      )}

      {/* Full Screen Preview Modal */}
      {fullScreenView && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col backdrop-blur-sm">
          {/* Floating Close Button */}
          <button
            onClick={() => setFullScreenView(null)}
            className="fixed top-4 right-4 z-[110] w-10 h-10 rounded-full bg-slate-900/50 hover:bg-slate-900 text-white flex items-center justify-center transition-all shadow-lg border border-white/10 backdrop-blur-md"
            title="Exit Fullscreen"
          >
            <X size={20} />
          </button>

          {/* Navigation Controls Overlay - Top Left */}
          <div className="fixed top-4 left-4 z-[110] flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
            <button
              disabled={!fullPreviewHistory.canGoBack}
              onClick={() => fullPreviewRef.current?.goBack()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fullPreviewHistory.canGoBack ? 'text-white hover:bg-white/10 active:scale-95' : 'text-white/20 cursor-not-allowed'}`}
              title="Back"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={!fullPreviewHistory.canGoForward}
              onClick={() => fullPreviewRef.current?.goForward()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fullPreviewHistory.canGoForward ? 'text-white hover:bg-white/10 active:scale-95' : 'text-white/20 cursor-not-allowed'}`}
              title="Forward"
            >
              <ChevronRight size={18} />
            </button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <div className="px-2 py-1 flex items-center gap-2">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-tighter">{fullScreenView === 'live' ? 'View' : 'Ref'}</span>
              <span className="text-[10px] font-bold text-white/90 truncate max-w-[100px]">{fullPreviewHistory.currentFile}</span>
            </div>
          </div>

          <div className="flex-1 bg-white overflow-hidden relative">
            {fullScreenView === 'live' ? (
              <PreviewFrame
                ref={fullPreviewRef}
                code={code}
                initialFile={previewHistory.currentFile}
                isNodeJS={challenge?.challengeType === 'nodejs'}
                autoRun={true}
                onConsoleLog={setConsoleOutput}
                isRestricted={restrictions.blockCopy}
                onHistoryChange={setFullPreviewHistory}
                stdin={stdin}
              />
            ) : (
              <div className="w-full h-full p-4 overflow-auto flex items-center justify-center bg-slate-100/30">
                {challenge.assets?.reference ? (
                  <img
                    src={challenge.assets.reference}
                    alt="Expected Reference"
                    className="max-h-full shadow-2xl border border-slate-200 object-contain"
                    onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50" fill="gray">No Reference Found</text></svg>' }}
                  />
                ) : (
                  <PreviewFrame
                    autoRun={true}
                    code={{
                      html: challenge.expectedHtml || "",
                      css: challenge.expectedCss || "",
                      js: challenge.expectedJs || ""
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
