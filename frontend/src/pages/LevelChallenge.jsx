import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, CheckCircle, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Check, Layout } from "lucide-react";
import CodeEditor from "../components/CodeEditor";
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
  const [code, setCode] = useState({ html: "", css: "", js: "" });
  const [submitting, setSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState("");
  const [result, setResult] = useState(null);
  const [previewTab, setPreviewTab] = useState("live");
  const [showInstructions, setShowInstructions] = useState(true);
  const [showEvaluationPanel, setShowEvaluationPanel] = useState(true);
  const [userAnswers, setUserAnswers] = useState({});
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [testSessionId, setTestSessionId] = useState(null);
  const [finishingLevel, setFinishingLevel] = useState(false);

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

  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState('loading'); // loading, none, requested, approved, rejected
  const [attendanceTimer, setAttendanceTimer] = useState(null);
  const [startedAt, setStartedAt] = useState(null);



  useEffect(() => {
    if (assignedQuestions.length > 0) {
      loadCurrentQuestion();
    }
  }, [currentQuestionIndex, assignedQuestions]);

  // Check Attendance on Mount
  useEffect(() => {
    if (courseId && level) {
      checkAttendance();
    }
    return () => clearInterval(attendanceTimer);
  }, [courseId, level]);

  const checkAttendance = async () => {
    // Admin bypass - skip attendance check entirely
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      setAttendanceStatus('started');
      setLoading(false);
      startTest();
      return;
    }

    try {
      const res = await api.get('/attendance/status', { params: { courseId, level } });
      const status = res.data.status;

      setAttendanceStatus(status);

      // Check for active test session to auto-resume
      const sessionRes = await api.post("/test-sessions", {
        user_id: userId,
        course_id: courseId,
        level: parseInt(level),
      });

      if (sessionRes.data && !sessionRes.data.completed_at) {
        setTestSessionId(sessionRes.data.id);
        if (sessionRes.data.started_at) setStartedAt(sessionRes.data.started_at);

        if (status === 'approved') {
          // If approved AND session exists, auto-start
          startTest();
        }
      }

      if (status === 'requested' && !attendanceTimer) {
        // Start polling
        const timer = setInterval(async () => {
          const pollRes = await api.get('/attendance/status', { params: { courseId, level } });
          if (pollRes.data.status === 'approved') {
            setAttendanceStatus('approved');
            clearInterval(timer);
          } else if (pollRes.data.status === 'rejected') {
            setAttendanceStatus('rejected');
            clearInterval(timer);
          }
        }, 3000);
        setAttendanceTimer(timer);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Attendance check failed", error);
      setAttendanceStatus('error');
      setLoading(false);
    }
  };

  const requestAttendance = async () => {
    try {
      await api.post('/attendance/request', { courseId, level });
      setAttendanceStatus('requested');
      checkAttendance(); // Start polling
    } catch (err) {
      alert('Failed to request attendance');
    }
  };

  const startTest = () => {
    loadLevelQuestions();
    loadRestrictions();
    setAttendanceStatus('started'); // distinct state to hide the wall
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
          submitted: false,
          result: null,
        };
      });
      setUserAnswers(initialAnswers);

      // Create test session
      await createTestSession();

      // Fetch and apply restrictions
      try {
        const restrictionsRes = await api.get(`/courses/${courseId}/restrictions`);
        if (restrictionsRes.data) {
          setRestrictions(restrictionsRes.data);
          console.log('Loaded restrictions:', restrictionsRes.data);
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

  // Auto-save to localStorage
  useEffect(() => {
    if (assignedQuestions.length > 0) {
      const storageKey = `assessment_${userId}_${courseId}_${level}`;
      localStorage.setItem(storageKey, JSON.stringify({
        questions: assignedQuestions,
        answers: userAnswers,
        currentIndex: currentQuestionIndex,
        code
      }));
    }
  }, [code, userAnswers, currentQuestionIndex, assignedQuestions]);

  // Restrictions Enforcement - Copy/Paste blocking
  useEffect(() => {
    if (!restrictions.blockCopy) return;

    const handleCopy = (e) => {
      e.preventDefault();
      recordViolation('Copy attempt blocked');
    };

    const handlePaste = (e) => {
      if (restrictions.blockPaste) {
        e.preventDefault();
        recordViolation('Paste attempt blocked');
      }
    };

    const handleCut = (e) => {
      e.preventDefault();
      recordViolation('Cut attempt blocked');
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
    };
  }, [restrictions.blockCopy, restrictions.blockPaste]);

  // Restrictions Enforcement - Fullscreen
  useEffect(() => {
    if (!restrictions.forceFullscreen) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('Exited fullscreen mode');
        // Try to re-enter fullscreen
        document.documentElement.requestFullscreen?.().catch(() => { });
      }
    };

    // Request fullscreen on mount
    document.documentElement.requestFullscreen?.().catch(() => {
      console.warn('Could not enter fullscreen - user interaction may be required');
    });

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      // Exit fullscreen on unmount
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => { });
      }
    };
  }, [restrictions.forceFullscreen]);

  // Record violation helper
  const recordViolation = (message) => {
    const now = Date.now();
    // Debounce - only record if at least 1 second has passed
    if (now - lastViolationTime < 1000) return;

    setLastViolationTime(now);
    setViolations(prev => {
      const newCount = prev + 1;
      if (newCount >= restrictions.maxViolations) {
        // Auto-submit and lock out
        alert(`You have exceeded the maximum allowed violations (${restrictions.maxViolations}). Your test will be submitted.`);
        handleFinishLevel();
      }
      return newCount;
    });

    // Show toast notification
    setViolationMessage(message);
    setShowViolationToast(true);
    setTimeout(() => setShowViolationToast(false), 3000);
  };

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

      // Load saved answer if exists
      const savedAnswer = userAnswers[questionId];
      if (savedAnswer && (savedAnswer.html || savedAnswer.css || savedAnswer.js)) {
        setCode({
          html: savedAnswer.html,
          css: savedAnswer.css,
          js: savedAnswer.js,
        });
        setResult(savedAnswer.result);
      } else {
        // Fallback to localStorage or keep current
      }
    } catch (error) {
      console.error("Failed to load question:", error);
    }
  };

  // Load restrictions from API
  const loadRestrictions = async () => {
    try {
      const response = await api.get(`/courses/${courseId}/restrictions`);
      if (response.data) {
        setRestrictions(response.data);
        // Initialize timer if timeLimit is set
        if (response.data.timeLimit > 0) {
          setTimeRemaining(response.data.timeLimit * 60); // Convert minutes to seconds
        }
      }
    } catch (error) {
      console.error("Failed to load restrictions:", error);
    }
  };

  // Sync Timer with Server Session
  useEffect(() => {
    if (startedAt && restrictions.timeLimit > 0) {
      const start = new Date(startedAt).getTime();
      const limitSec = restrictions.timeLimit * 60;
      const now = Date.now();
      const elapsedSec = (now - start) / 1000;
      const remaining = Math.max(0, limitSec - elapsedSec);
      // Only update if significantly different (prevention of loops, though dependencies handle it)
      setTimeRemaining(Math.ceil(remaining));
    }
  }, [startedAt, restrictions.timeLimit]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          alert("Time is up! Your test will be submitted automatically.");
          handleFinishLevel({ reason: "timeout" });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

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

    setLastViolationTime(now);
    const newViolations = violations + 1;
    setViolations(newViolations);

    setViolationMessage(`${type}`);
    setShowViolationToast(true);
    setTimeout(() => setShowViolationToast(false), 3000);

    if (newViolations >= restrictions.maxViolations) {
      setTimeout(() => {
        alert("Maximum violations reached! Test will be submitted.");
        handleFinishLevel({ reason: "violations" });
      }, 500);
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
      if (
        (e.ctrlKey || e.metaKey) &&
        restrictions.blockCopy &&
        (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X")
      ) {
        e.preventDefault();
        handleViolation("Copy shortcut blocked");
      }
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
  }, [restrictions, violations]);

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
        },
      }));
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setResult(null);
      setPreviewTab("live");
    }
  };

  const handleRunCode = () => {
    if (previewRef.current) {
      previewRef.current.updatePreview(code);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setEvaluating(true);
    setResult(null);
    setEvaluationStep("Submitting your solution...");

    const questionId = challenge.id;

    try {
      // Step 1: Create submission
      setEvaluationStep("Creating submission...");
      const submitResponse = await api.post("/submissions", {
        challengeId: questionId,
        userId: userId,
        code: {
          html: code.html,
          css: code.css,
          js: code.js,
        },
      });

      const submissionId = submitResponse.data.submissionId;

      setEvaluationStep("Launching browser environment...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      setEvaluationStep("Rendering your code...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      setEvaluationStep("Comparing with expected solution...");

      // Step 2: Evaluate submission
      const evalResponse = await api.post("/evaluate", {
        submissionId: submissionId,
      });

      const evalResult = evalResponse.data.result;
      // HIDE RESULT: Do not show immediate pass/fail modal
      // setResult(evalResult); 

      // Save result
      setUserAnswers((prev) => ({
        ...prev,
        [questionId]: {
          html: code.html,
          css: code.css,
          js: code.js,
          submitted: true,
          result: evalResult,
          submissionId: submissionId // Store ID for feedback redirect
        },
      }));

      // Add submission to test session
      if (testSessionId && submissionId) {
        try {
          await api.post(`/test-sessions/${testSessionId}/submissions`, {
            submission_id: submissionId,
          });
          console.log("Added submission to test session");
        } catch (err) {
          console.error("Failed to add submission to session:", err);
        }
      }

      setEvaluationStep("");
      alert("Solution submitted! Proceed to next question or finish test.");

    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to submit solution.");
      setEvaluationStep("");
    } finally {
      setSubmitting(false);
      setEvaluating(false);
    }
  };

  const handleFinishLevel = async ({ reason = "manual" } = {}) => {
    if (finishingLevel) return;

    setFinishingLevel(true);

    try {
      // Get the last submission ID for feedback
      const lastQuestionId = assignedQuestions[assignedQuestions.length - 1]?.id;
      const lastSubmissionId = userAnswers[lastQuestionId]?.submissionId;

      if (testSessionId) {
        await api.put(`/test-sessions/${testSessionId}/complete`, {
          user_feedback: null,
        });
      }

      // Redirect to feedback if we have a submission, else dashboard
      if (lastSubmissionId) {
        navigate(`/student/feedback/${lastSubmissionId}`);
      } else {
        navigate(`/course/${courseId}`);
      }

    } catch (error) {
      console.error("Error finishing level:", error);
      navigate(`/course/${courseId}`);
    }
  };

  const handleFinishTest = () => {
    const summary = computeProgressSummary();
    setFinalScore(summary);
    setShowFinishModal(true);
  };

  const handleSubmitFeedback = async () => {
    try {
      const completionData = await saveCompletionProgress(finalScore, {
        feedback,
      });

      // Close modal and navigate
      setShowFinishModal(false);
      navigate(`/level-results/${courseId}/${level}`, {
        state: {
          userAnswers,
          assignedQuestions,
          completionData,
        },
      });
    } catch (error) {
      console.error("Failed to save completion:", error);
      // Still navigate even if save fails
      setShowFinishModal(false);
      navigate(`/level-results/${courseId}/${level}`, {
        state: { userAnswers, assignedQuestions },
      });
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200 text-center max-w-lg w-full border border-slate-100 animate-fade-in">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-500/10">
            <Layout size={40} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Security Checkpoint</h2>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            Standard protocol requires administrative approval for this assessment sequence.
          </p>

          {attendanceStatus === 'none' && (
            <div className="space-y-4">
              <button
                onClick={requestAttendance}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10"
              >
                Request Authorization
              </button>
              <button
                onClick={() => navigate(`/course/${courseId}`)}
                className="w-full py-3 bg-white text-slate-400 font-bold text-[11px] uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Return to Curriculum
              </button>
            </div>
          )}

          {attendanceStatus === 'requested' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-blue-700 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3">
                <Clock size={16} className="animate-spin" />
                Wait for verification...
              </div>
              <p className="text-sm text-slate-400 font-medium">
                Sequence queued. An administrator will review your credentials shortly.
              </p>
            </div>
          )}

          {attendanceStatus === 'rejected' && (
            <div className="space-y-6">
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-rose-700 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3">
                <AlertTriangle size={16} /> Access Denied
              </div>
              <button
                onClick={() => navigate(`/course/${courseId}`)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold"
              >
                Return to Base
              </button>
            </div>
          )}

          {attendanceStatus === 'approved' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-emerald-700 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3">
                <CheckCircle size={16} /> Verified & Cleared
              </div>
              <button
                onClick={startTest}
                className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                Initialize Logic Test
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

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button
                onClick={() => navigate(`/course/${courseId}`)}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
              >
                <ArrowLeft size={16} /> Back to Course
              </button>
              <h1 className="text-2xl font-bold">{challenge.title}</h1>
              <p className="text-gray-600">
                Level {level}{" "}
                {assignedQuestions.length > 1 &&
                  `• Question ${currentQuestionIndex + 1} of ${assignedQuestions.length
                  }`}
              </p>
            </div>

            {/* Question Navigator with Timer */}
            <div className="flex items-center gap-3">
              {/* Small Timer */}
              {restrictions.timeLimit > 0 && timeRemaining !== null && (
                <div
                  className={`px-3 py-2 rounded border font-mono font-bold flex items-center gap-2 ${timeRemaining <= 300
                    ? "bg-red-50 border-red-300 text-red-600"
                    : "bg-blue-50 border-blue-300 text-blue-600"
                    }`}
                >
                  <Clock size={16} /> {formatTime(timeRemaining)}
                </div>
              )}

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
                onClick={handleFinishLevel}
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
              disabled={submitting || evaluating}
              className="btn-success disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting || evaluating
                ? "Evaluating..."
                : "✓ Submit & Evaluate"}
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
        <div className="flex flex-col gap-4 overflow-auto">
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
            <div className="card">
              <h2 className="text-lg font-bold mb-3">
                {challenge.description || "Challenge Instructions"}
              </h2>

              <div className="text-gray-700 whitespace-pre-wrap mb-4">
                {challenge.instructions || challenge.description}
              </div>

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
            className={`card ${showInstructions ? "flex-1" : "flex-1"}`}
            style={
              !showInstructions ? { minHeight: "calc(100vh - 250px)" } : {}
            }
          >
            <CodeEditor code={code} onChange={setCode} />
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
                  <PreviewFrame ref={previewRef} code={code} />
                ) : challenge?.expectedSolution ? (
                  <PreviewFrame
                    code={{
                      html: challenge.expectedSolution.html || "",
                      css: challenge.expectedSolution.css || "",
                      js: challenge.expectedSolution.js || "",
                    }}
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
          {(evaluating || result) && (
            <div
              className={`card mt-4 shrink-0 transition-all duration-300 flex flex-col ${showEvaluationPanel ? "max-h-[40%]" : "max-h-14 overflow-hidden"
                }`}
            >
              <div
                className={`flex items-center justify-between ${showEvaluationPanel ? "mb-3" : "mb-0"
                  }`}
              >
                <h2 className="text-lg font-bold">Evaluation Results</h2>
                <button
                  onClick={() => setShowEvaluationPanel((prev) => !prev)}
                  className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  {showEvaluationPanel ? "Hide Panel" : "Show Panel"}
                </button>
              </div>
              {showEvaluationPanel && (
                <div className="flex-1 overflow-auto pr-2">
                  {evaluating ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-lg font-semibold text-gray-700 mb-2">
                        {evaluationStep || "Evaluating..."}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        This may take 5-10 seconds
                      </p>
                      <div className="max-w-md mx-auto text-left bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs font-semibold text-blue-900 mb-2">
                          🔄 Evaluation Process:
                        </p>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li>• Launching headless browser (Chrome)</li>
                          <li>• Rendering your code as screenshot</li>
                          <li>• Rendering expected solution</li>
                          <li>• Comparing DOM structure</li>
                          <li>• Comparing visual appearance (pixels)</li>
                          <li>• Calculating final score</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <ResultsPanel result={result} />
                  )}
                </div>
              )}
            </div>
          )}
          {/* Finish Test Modal */}
          {showFinishModal && finalScore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black opacity-40"
                onClick={() => setShowFinishModal(false)}
              ></div>
              <div className="bg-white rounded-lg shadow-lg z-20 w-full max-w-lg mx-4">
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">
                    Finish Test — Summary & Feedback
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Questions submitted: {finalScore.submittedCount}/
                    {finalScore.totalQuestions}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Questions Passed</div>
                      <div className="font-bold">
                        {finalScore.passedCount}/{finalScore.totalQuestions}
                      </div>
                    </div>
                    <div className="mb-2">
                      Average Score:{" "}
                      <span className="font-bold">{finalScore.avgScore}%</span>
                    </div>
                    <div className="mt-3 border rounded p-2 max-h-40 overflow-auto">
                      {finalScore.results.map((r, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1"
                        >
                          <div className="text-sm">
                            {idx + 1}. {r.questionTitle}
                          </div>
                          <div
                            className={`text-sm font-semibold ${r.passed ? "text-green-600" : "text-red-600"
                              }`}
                          >
                            {r.passed ? "Passed" : "Failed"} ({r.score}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="block text-sm font-medium mb-2">
                    Any feedback for this level (optional)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full border rounded p-2 mb-4"
                    rows={4}
                    placeholder="Tell us what went well or what was unclear..."
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowFinishModal(false)}
                      className="px-4 py-2 rounded bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      className="px-4 py-2 rounded bg-blue-600 text-white"
                    >
                      Submit & Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                : "✅ Expected Result (Full Screen)"}
              <span className="text-sm font-normal text-gray-500">
                {fullScreenView === "live" ? "- Your Code" : "- Target Design"}
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
              ) : (
                <PreviewFrame
                  code={{
                    html: challenge.expectedSolution.html || "",
                    css: challenge.expectedSolution.css || "",
                    js: challenge.expectedSolution.js || "",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
