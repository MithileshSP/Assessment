# Application Pages & Flow Documentation

This document outlines the existing frontend pages, backend API routes, and the primary user workflows within the application.

## Frontend Pages (React/Vite)

The frontend is built with React and uses `react-router-dom` for navigation.

### Public Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/login` | `Login.jsx` | Student/User login page. |
| `/admin/login` | `Login.jsx` (Admin Mode) | Administrator login page. |

### Student Portal (Protected)
Requires authentication. Uses `SaaSLayout.jsx`.

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `CoursesHome.jsx` | **Home Page**. Lists available courses in a premium card view. |
| `/course/:courseId` | `CourseDetail.jsx` | Details of a specific course, listing its levels/modules with lock logic. |
| `/course/:courseId/level/:level` | `LevelPage.jsx` | Introduction or overview page for a specific level. |
| `/level/:courseId/:level` | `LevelChallenge.jsx` | **Core Workspace**. The main interface where users perform assessments/challenges. |
| `/level-results/:courseId/:level` | `LevelResults.jsx` | Displays results after completing a level. |
| `/test-results/:sessionId` | `TestResultsPage.jsx` | Detailed results for a specific test session. |
| `/challenges` | `CandidateDashboard.jsx` | Repository of all available challenges for practice. |
| `/challenge/:id` | `ChallengeView.jsx` | View for a specific single challenge. |
| `/student/feedback/:submissionId` | `StudentFeedback.jsx` | Post-assessment feedback and meta-evaluation view. |

### Faculty Portal (Protected)
Requires faculty role. Uses `SaaSLayout.jsx`.

| Path | Component | Description |
|------|-----------|-------------|
| `/faculty/dashboard` | `FacultyDashboard.jsx` | **Faculty Hub**. View assigned submission queue. |
| `/faculty/evaluate/:submissionId` | `FacultyEvaluation.jsx` | Rubric-based evaluation workspace for manual grading. |

### Admin Portal (Protected)
Requires admin role. Uses `SaaSLayout.jsx`.

| Path | Component | Description |
|------|-----------|-------------|
| `/admin/dashboard` | `AdminDashboard.jsx` | **Admin Hub**. Widget-based overview of system health and pending items. |
| `/admin/courses` | `CourseManager.jsx` | CRUD operations for Courses and Level architecture. |
| `/admin/users` | `UserManagement.jsx` | High-fidelity user registry with bulk import (CSV) capabilities. |
| `/admin/attendance` | `AdminAttendance.jsx` | Real-time pending attendance request management. |
| `/admin/assignment` | `AdminAssignment.jsx` | Faculty workload management and auto-assignment engine. |
| `/admin/results` | `AdminResults.jsx` | Master results matrix (Auto + Manual scores). |
| `/admin/submission/:submissionId` | `AdminSubmissionDetails.jsx` | Deep-level inspection of source code and visual deltas. |
| `/admin/level-management` | `LevelManagement.jsx` | Manual progress resets and access control custodian. |

---

## Backend API Structure (Express)

The backend exposes RESTful endpoints, primarily serving JSON.

### Base URL: `/api`

| Resource | Route Prefix | Handler File | Description |
|----------|--------------|--------------|-------------|
| **Auth & Users** | `/api/auth`, `/api/users` | `routes/users.js` | User login, registration, and profile management. |
| **Courses** | `/api/courses` | `routes/courses.js` | Fetching course lists and details. |
| **Challenges** | `/api/challenges` | `routes/challenges.js` | CRUD for coding challenges/questions. |
| **Submissions** | `/api/submissions` | `routes/submissions.js` | Storing and retrieving user submissions. |
| **Evaluation** | `/api/evaluate` | `routes/evaluation.js` | Triggering code evaluation logic (likely runs tests/pixel matching). |
| **Admin** | `/api/admin` | `routes/admin.js` | Admin-specific actions and analytics. |
| **Level Completion** | `/api/level-completion` | `routes/levelCompletion.js` | Tracking user progress through levels. |
| **Level Access** | `/api/level-access` | `routes/levelAccess.js` | Controlling access to specific levels (unlock logic). |
| **Assets** | `/api/assets` | `routes/assets.js` | Managing static assets (images, resources). |
| **Test Sessions** | `/api/test-sessions` | `routes/testSessions.js` | Managing active testing sessions. |

### Static File Serving
- `/screenshots` -> Serves formatted screenshots from `backend/screenshots`.
- `/assets` -> Serves general assets from `backend/assets`.

---

## core Workflows

### 1. User Assessment Flow
1.  **Login**: User logs in at `/login`.
2.  **Course Selection**: User sees `CoursesHome` (`/`), selects a course.
3.  **Level Entry**: User navigates to a level (`/course/:id/level/:lvl`).
4.  **Challenge Execution**:
    -   User lands on `LevelChallenge` (`/level/:id/:lvl`).
    -   User writes code/answers questions.
    -   **Submission**: Frontend sends data to `POST /api/evaluate` or `POST /api/submissions`.
5.  **Feedback**:
    -   Backend processes submission.
    -   User is redirected to `LevelResults` or `TestResultsPage` to see score/pass-fail status.
    -   Progress is updated via `/api/level-completion`.

### 2. Admin Management Flow
1.  **Login**: Admin logs in at `/admin/login`.
2.  **Dashboard**: Lands on `AdminDashboard` to see system health/stats.
3.  **User Management**:
    -   Navigate to `/admin/users` to view list.
    -   Use `/admin/add-users` to onboard new students (bulk import).
4.  **Content Management**:
    -   Use `/admin/courses` and `/admin/level-management` to structure curriculum.
5.  **Review**:
    -   Admin looks at specific submissions via `/admin/submission/:id` to manually review code or check auto-grading errors.

## Tech Stack Overview
-   **Frontend**: React, Vite, Tailwind CSS (inferred from config).
-   **Backend**: Node.js, Express.
-   **Database**: MySQL (implied by `mysql-init` folder).
-   **Containerization**: Docker (Dockerfiles present in both frontend and backend).
