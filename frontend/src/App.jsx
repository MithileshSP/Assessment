import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";

// Student Portal
import CoursesHome from "./pages/CoursesHome";
import CourseDetail from "./pages/CourseDetail";
import LevelPage from "./pages/LevelPage";
import LevelChallenge from "./pages/LevelChallenge";
import LevelResults from "./pages/LevelResults";
import TestResultsPage from "./pages/TestResultsPage";
import CandidateDashboard from "./pages/CandidateDashboard";
import ChallengeView from "./pages/ChallengeView";
import StudentFeedback from "./pages/StudentFeedback";
import UserProfile from "./pages/UserProfile";
import StudentResults from "./pages/StudentResults";
import Logout from "./pages/Logout";

// Faculty Portal
import FacultyDashboard from "./pages/FacultyDashboard";
import FacultyEvaluation from "./pages/FacultyEvaluation";
import FacultyHistory from "./pages/FacultyHistory";
import FacultyQuestions from "./pages/FacultyQuestions";

// Admin Portal
import AdminDashboard from "./pages/AdminDashboard";
import AdminAttendance from "./pages/AdminAttendance";
import AdminAssignment from "./pages/AdminAssignment";
import AdminResults from "./pages/AdminResults";
import AdminSubmissionDetails from "./pages/AdminSubmissionDetails";
import CourseManager from "./pages/CourseManager";
import UserManagement from "./pages/UserManagement";
import LevelManagement from "./pages/LevelManagement";
import QuestionBank from "./pages/QuestionBank";
import AdminLevelReset from "./pages/AdminLevelReset";
import RestrictionManagement from "./pages/RestrictionManagement";
import AdminEvaluationTracker from "./pages/AdminEvaluationTracker";
import AdminAssetManager from "./pages/AdminAssetManager";

// Auth & Components
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { getUserRole } from "./utils/session";

function App() {
  const [role, setRole] = useState(() => getUserRole());

  useEffect(() => {
    const handleSessionChange = () => setRole(getUserRole());
    window.addEventListener('portal-session-change', handleSessionChange);
    return () => {
      window.removeEventListener('portal-session-change', handleSessionChange);
    };
  }, []);

  const handleLogin = (session) => {
    setRole(session?.role || getUserRole());
  };

  return (
    <Router basename={window.location.pathname.startsWith('/fullstack') ? '/fullstack' : '/'} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          {/* Authentication */}
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/admin/login" element={<Login isAdmin={true} onLogin={handleLogin} />} />

          {/* Student Portal */}
          <Route path="/" element={<ProtectedRoute><CoursesHome /></ProtectedRoute>} />
          <Route path="/course/:courseId" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
          <Route path="/course/:courseId/level/:level" element={<ProtectedRoute><LevelPage /></ProtectedRoute>} />
          <Route path="/level/:courseId/:level" element={<ProtectedRoute><LevelChallenge /></ProtectedRoute>} />
          <Route path="/level-results/:courseId/:level" element={<ProtectedRoute><LevelResults /></ProtectedRoute>} />
          <Route path="/test-results/:sessionId" element={<ProtectedRoute><TestResultsPage /></ProtectedRoute>} />
          <Route path="/challenges" element={<ProtectedRoute><CandidateDashboard /></ProtectedRoute>} />
          <Route path="/challenge/:id" element={<ProtectedRoute><ChallengeView /></ProtectedRoute>} />
          <Route path="/student/feedback/:submissionId" element={<ProtectedRoute><StudentFeedback /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/results" element={<ProtectedRoute><StudentResults /></ProtectedRoute>} />
          <Route path="/logout" element={<Logout />} />

          {/* Faculty Portal */}
          <Route path="/faculty/dashboard" element={role === 'faculty' ? <FacultyDashboard /> : <Navigate to="/login" />} />
          <Route path="/faculty/submissions" element={role === 'faculty' ? <FacultyDashboard /> : <Navigate to="/login" />} />
          <Route path="/faculty/history" element={role === 'faculty' ? <FacultyHistory /> : <Navigate to="/login" />} />
          <Route path="/faculty/questions" element={role === 'faculty' ? <FacultyQuestions /> : <Navigate to="/login" />} />
          <Route path="/faculty/evaluate/:submissionId" element={role === 'faculty' ? <FacultyEvaluation /> : <Navigate to="/login" />} />

          {/* Admin Portal */}
          <Route path="/admin/dashboard" element={role === 'admin' ? <AdminDashboard /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/attendance" element={role === 'admin' ? <AdminAttendance /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/courses" element={role === 'admin' ? <CourseManager /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/users" element={role === 'admin' ? <UserManagement /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/results" element={role === 'admin' ? <AdminResults /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/assignment" element={role === 'admin' ? <AdminAssignment /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/submission/:submissionId" element={role === 'admin' ? <AdminSubmissionDetails /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/level-management" element={role === 'admin' ? <LevelManagement /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/course/:courseId/questions" element={(role === 'admin' || role === 'faculty') ? <QuestionBank /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/reset-level" element={role === 'admin' ? <AdminLevelReset /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/restrictions" element={role === 'admin' ? <RestrictionManagement /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/evaluation-tracker" element={role === 'admin' ? <AdminEvaluationTracker /> : <Navigate to="/admin/login" />} />
          <Route path="/admin/assets" element={role === 'admin' ? <AdminAssetManager /> : <Navigate to="/admin/login" />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
