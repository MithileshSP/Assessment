import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

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
import AdminAssetManager from "./pages/AdminAssetManager";
import AdminSchedule from "./pages/AdminSchedule";
import QuestionEditor from "./pages/QuestionEditor";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBulkCompletion from "./pages/AdminBulkCompletion";
import AdminViolations from "./pages/AdminViolations";
import AdminFacultyList from "./pages/AdminFacultyList";
import AdminFacultyDetail from "./pages/AdminFacultyDetail";
import AdminAccessControl from "./pages/AdminAccessControl";
import AdminBackup from "./pages/AdminBackup";

// Auth & Components
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { useParams } from "react-router-dom";

// LSP Helper: Redirect /course/:id to /course/:id/level/1
function CourseRedirect() {
  const { courseId } = useParams();
  return <Navigate to={`/course/${courseId}/level/1`} replace />;
}

// Role-gated route wrapper using server-verified auth context
function RoleRoute({ requiredRole, children, redirectTo = "/login", permissionId, masterOnly }) {
  const { role, loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (requiredRole && role !== requiredRole && !(requiredRole === 'admin_or_faculty' && (role === 'admin' || role === 'faculty')))) {
    return <Navigate to={redirectTo} />;
  }

  // Permission Check for Admins
  if (role === 'admin') {
    const isMaster = !!(user?.is_master || user?.isMaster);

    if (masterOnly && !isMaster) {
      return <Navigate to="/admin/dashboard" replace />;
    }

    if (!isMaster && permissionId) {
      let perms = user?.permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { perms = null; }
      }

      // If perms is an array, we enforce it strictly (even if it's empty).
      if (Array.isArray(perms) && !perms.includes(permissionId)) {
        return <Navigate to="/admin/dashboard" replace />;
      }
    }
  }

  return children;
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login isAdmin={true} />} />

        {/* Student Portal */}
        <Route path="/" element={<ProtectedRoute><CoursesHome /></ProtectedRoute>} />

        {/* LSP Flow: Direct Level Access (New Simplified Route) */}
        <Route path="/level/:levelId" element={<ProtectedRoute><LevelChallenge /></ProtectedRoute>} />

        {/* Backward Compatibility: Old course routes redirect to new level routes */}
        <Route path="/course/:courseId/level/:level" element={<ProtectedRoute><LevelChallenge /></ProtectedRoute>} />
        <Route path="/course/:courseId" element={<ProtectedRoute><CourseRedirect /></ProtectedRoute>} />

        {/* Legacy Redirects or Fallbacks if needed, but we try to move forward */}
        <Route path="/level-results/:courseId" element={<ProtectedRoute><LevelResults /></ProtectedRoute>} />
        <Route path="/test-results/:sessionId" element={<ProtectedRoute><TestResultsPage /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><CandidateDashboard /></ProtectedRoute>} />
        <Route path="/challenge/:id" element={<ProtectedRoute><ChallengeView /></ProtectedRoute>} />
        <Route path="/student/feedback/:submissionId" element={<ProtectedRoute><StudentFeedback /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><StudentResults /></ProtectedRoute>} />
        <Route path="/logout" element={<Logout />} />

        {/* Faculty Portal - Server-verified role check */}
        <Route path="/faculty/dashboard" element={<RoleRoute requiredRole="faculty" redirectTo="/login"><FacultyDashboard /></RoleRoute>} />
        <Route path="/faculty/submissions" element={<RoleRoute requiredRole="faculty" redirectTo="/login"><FacultyDashboard /></RoleRoute>} />
        <Route path="/faculty/history" element={<RoleRoute requiredRole="faculty" redirectTo="/login"><FacultyHistory /></RoleRoute>} />
        <Route path="/faculty/questions" element={<RoleRoute requiredRole="faculty" redirectTo="/login"><FacultyQuestions /></RoleRoute>} />
        <Route path="/faculty/evaluate/:submissionId" element={<RoleRoute requiredRole="faculty" redirectTo="/login"><FacultyEvaluation /></RoleRoute>} />

        {/* Admin Portal - Server-verified role check */}
        <Route path="/admin/dashboard" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login"><AdminDashboard /></RoleRoute>} />
        <Route path="/admin/attendance" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="attendance"><AdminAttendance /></RoleRoute>} />
        <Route path="/admin/schedule" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="schedule"><AdminSchedule /></RoleRoute>} />
        <Route path="/admin/courses" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="courses"><CourseManager /></RoleRoute>} />
        <Route path="/admin/users" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="users"><UserManagement /></RoleRoute>} />
        <Route path="/admin/results" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="results"><AdminResults /></RoleRoute>} />
        <Route path="/admin/assignment" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="faculty"><AdminAssignment /></RoleRoute>} />
        <Route path="/admin/faculty" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="faculty"><AdminFacultyList /></RoleRoute>} />
        <Route path="/admin/faculty/:facultyId" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="faculty"><AdminFacultyDetail /></RoleRoute>} />
        <Route path="/admin/submission/:submissionId" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="results"><AdminSubmissionDetails /></RoleRoute>} />
        <Route path="/admin/level-management" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="courses"><LevelManagement /></RoleRoute>} />
        <Route path="/admin/course/:courseId/questions" element={<RoleRoute requiredRole="admin_or_faculty" redirectTo="/admin/login" permissionId="courses"><QuestionBank /></RoleRoute>} />
        <Route path="/admin/course/:courseId/question/add" element={<RoleRoute requiredRole="admin_or_faculty" redirectTo="/admin/login" permissionId="courses"><QuestionEditor /></RoleRoute>} />
        <Route path="/admin/course/:courseId/question/edit/:questionId" element={<RoleRoute requiredRole="admin_or_faculty" redirectTo="/admin/login" permissionId="courses"><QuestionEditor /></RoleRoute>} />
        <Route path="/admin/reset-level" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="reset"><AdminLevelReset /></RoleRoute>} />
        <Route path="/admin/restrictions" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="restrictions"><RestrictionManagement /></RoleRoute>} />
        <Route path="/admin/assets" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="assets"><AdminAssetManager /></RoleRoute>} />
        <Route path="/admin/analytics" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="dashboard"><AdminAnalytics /></RoleRoute>} />
        <Route path="/admin/bulk-completion" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="bulk-completion"><AdminBulkCompletion /></RoleRoute>} />
        <Route path="/admin/violations" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="violations"><AdminViolations /></RoleRoute>} />
        <Route path="/admin/backup" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" permissionId="results"><AdminBackup /></RoleRoute>} />
        <Route path="/admin/access-control" element={<RoleRoute requiredRole="admin" redirectTo="/admin/login" masterOnly={true}><AdminAccessControl /></RoleRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router basename={window.location.pathname.startsWith('/fullstack') ? '/fullstack' : '/'} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
