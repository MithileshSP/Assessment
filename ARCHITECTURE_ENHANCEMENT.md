# Architecture Enhancement: Role-Based Assessment Platform

This document outlines the architectural plan to enhance the current platform into a robust, role-based SaaS product.

## 1. Role-Based Page List

### Student Module (Enhanced)
*Existing routes preserved. New logic injected.*
*   `/dashboard` (Student Dashboard - New Wrapper)
*   `/course/:id` (Existing)
*   `/level/:courseId/:level` (Existing - **Enhanced with Attendance/Timer**)
*   `/feedback/:submissionId` (**New** - Post-submission feedback)

### Faculty Module (**New**)
*   `/faculty/dashboard` (Overview of assigned work)
*   `/faculty/submissions` (List of pending evaluations)
*   `/faculty/evaluate/:submissionId` (Evaluation Workspace)
*   `/faculty/history` (Past evaluations)

### Admin Module (Enhanced)
*   `/admin/dashboard` (Existing - Add System Health/Attendance Widgets)
*   `/admin/users` (Existing - Add Role Filter & Faculty Management)
*   `/admin/attendance` (**New** - Attendance Approval Center)
*   `/admin/faculty-allocation` (**New** - Assign faculty to courses)
*   `/admin/analytics` (**New** - Feedback & Performance Reports)

---

## 2. Dashboard Layouts & UI Structure

**Design Philosophy**: "Enterprise SaaS" - Clean, Flat, Dense Data, No Fluff.
**Colors**: Charcoal (`#1e293b`), Muted Blue (`#3b82f6`), Slate Gray (`#64748b`), White/Off-White.

### A. Student Dashboard
*   **Top Bar**: Logo, User Profile, Notification Bell (Attendance Status).
*   **Sidebar**: My Courses, Results, Profile.
*   **Main Content**:
    *   "Active Tests" Card: Shows booked tests with "Request Attendance" button or "Start" status.
    *   "Recent Progress" Chart.
    *   List of enrolled courses.
*   **Test Screen (LevelChallenge)**:
    *   **Overlay**: If attendance not approved -> "Waiting for Admin Approval".
    *   **Top Bar**: Server-Synced Timer (Fixed position), "Finish Test" button.

### B. Faculty Dashboard
*   **Sidebar**: Overview, Pending Evaluations, History.
*   **Main Content (Overview)**:
    *   Stats Cards: "Pending Reviews", "Avg Turnaround Time", "Total Evaluated".
    *   "Urgent Allocations" Table: Submissions waiting > 24hrs.
*   **Evaluation Workspace (`/faculty/evaluate/:id`)**:
    *   **Structure**: Three-column layout.
    *   **Left (20%)**: Student Info, Test Metadata, Screenshots (Click to expand).
    *   **Middle (50%)**: Code Viewer (ReadOnly, Syntax Highlighted, File Tree).
    *   **Right (30%)**: Evaluation Form (Sticky).
        *   Rubric Sliders/Inputs: Code Quality (0-40), Requirements (0-25), Output (0-35).
        *   "Comments" Textarea.
        *   "Submit Evaluation" Button (Primary Color).

### C. Admin Dashboard
*   **Sidebar**: Users, Courses, Attendance (Badge: Count Pending), Faculty, Analytics.
*   **Attendance Center**:
    *   Live Feed Table: Name, Test, Time Requested, Action (Approve [Green] / Reject [Red]).
    *   "Approve All" button for specific sessions.
*   **Faculty Allocation**:
    *   Drag-and-drop or Multi-select interface to map `Faculty User` -> `Course` or `Level`.
    *   Toggle: "Auto-Assign" (Round-robin logic).

---

## 3. Component-Level Breakdown

### Shared Components
*   `RoleBasedRoute`: Higher Order Component to check `user.role` and redirect `unauthorized`.
*   `StatusBadge`: Reusable badge (Pending=Yellow, Approved=Green, Rejected=Red).
*   `SaaSLayout`: Standard wrapper with Sidebar and Topbar.

### Student Components
*   `AttendanceRequestWidget`: Handles "Request Access" button and polling for status.
*   `SecureTimer`: Fetches server time, handles countdown, forces auto-submit on 0.
*   `FeedbackModal`: Simple 5-star + comment form.

### Faculty Components
*   `SubmissionqueueTable`: Sortable table of assignees.
*   `CodeDiffViewer`: Displays student code.
*   `RubricScorer`: Input validation ensuring scores <= max limits.

### Admin Components
*   `AttendanceConsole`: Real-time list of requests using polling/sockets.
*   `FacultyManager`: User table filtered by role='faculty' with "Assign Course" modal.

---

## 4. API Extension Plan

### 4.1 Authentication & User
*   **MODIFY** `POST /api/auth/login`: Return correct dashboard URL based on role.
*   **NEW** `POST /api/users/faculty`: Create faculty user.

### 4.2 Attendance System
*   **NEW** `POST /api/attendance/request`: `{ userId, testId }`.
*   **NEW** `GET /api/attendance/status`: Returns `{ status: 'pending'|'approved', timerStarted: boolean }`.
*   **NEW** `POST /api/attendance/approve`: Admin only. `{ requestId, action: 'approve'|'reject' }`.

### 4.3 Timer & Test Session
*   **NEW** `POST /api/test/start`: Starts server-side timer for session. Returns `{ startTime, duration }`.
*   **NEW** `GET /api/test/heartbeat`: Syncs timer.

### 4.4 Faculty Evaluation
*   **NEW** `GET /api/faculty/queue`: List of submissions assigned to logged-in faculty.
*   **NEW** `GET /api/faculty/submission/:id`: Full details for evaluation.
*   **NEW** `POST /api/faculty/evaluate`: `{ submissionId, scores: { quality, req, output }, comments }`.

---

## 5. Permission Matrix

| Feature | Student | Faculty | Admin |
| :--- | :---: | :---: | :---: |
| **Login** | ✅ | ✅ | ✅ |
| **Take Test** | ✅ (If Approved) | ❌ | ❌ |
| **Request Attendance** | ✅ | ❌ | ❌ |
| **Approve Attendance** | ❌ | ❌ | ✅ |
| **View Own Results** | ✅ (Limited) | ❌ | ❌ |
| **View Any Result** | ❌ | ❌ | ✅ |
| **View Assigned Subs** | ❌ | ✅ | ✅ |
| **Manual Evaluation** | ❌ | ✅ | ✅ |
| **Manage Users** | ❌ | ❌ | ✅ |
| **Assign Faculty** | ❌ | ❌ | ✅ |
| **System Config** | ❌ | ❌ | ✅ |

---

## 6. Clean UI Wireframe Description (Textual)

**Screen: Faculty Evaluation View**
```text
+---------------------------------------------------------------+
| [Logo] Faculty Dashboard                        [User Profile]|
+---------------------------------------------------------------+
| Back to Queue |                                               |
+-----------------------+-----------------------+---------------+
| STUDENT INFO          | FILE: script.js       | EVALUATION    |
| Name: John Doe        | [Code Editor View]    |               |
| Course: Fullstack     | 1. const app = ...    | Code Quality  |
| Level: 2              | 2. app.use(cors...    | [====--] 32/40|
| Time: 45m             | 3.                    |               |
|                       |                       | Requirements  |
| SCREENSHOTS           |                       | [===---] 15/25|
| [Thumb1] [Thumb2]     |                       |               |
|                       |                       | Output Match  |
|                       |                       | [=====.] 30/35|
|                       |                       |               |
|                       |                       | Total: 77/100 |
|                       |                       |               |
|                       |                       | [Submit]      |
+-----------------------+-----------------------+---------------+
```

**Screen: Admin Attendance Console**
```text
+---------------------------------------------------------------+
| [Logo] Admin | Dashboard | Users | [Attendance] | Settings    |
+---------------------------------------------------------------+
| ATTENDANCE REQUESTS (5 Pending)                 [Approve All] |
+---------------------------------------------------------------+
| Student      | Test          | Time     | Status     | Action |
|--------------|---------------|----------|------------|--------|
| A. Smith     | Node-L1       | 10:05 AM | Requested  | [Y][N] |
| B. Jones     | Node-L1       | 10:06 AM | Requested  | [Y][N] |
| C. White     | React-L3      | 10:08 AM | Approved   | [Reset]|
+---------------------------------------------------------------+
```
