/**
 * API Service
 * All backend API calls centralized here
 */

import axios from 'axios';

// Use environment variable or relative path
// Universal API URL: detects if running under /fullstack or root
// Universal API URL: detects if running under /fullstack or root
export const BASE_URL = import.meta.env.VITE_API_URL ||
  (window.location.pathname.startsWith('/fullstack') ? '/fullstack/api' : '/api');
const API_BASE_URL = BASE_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Crucial for HttpOnly cookies
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 120000 // 120 seconds for evaluation requests (Puppeteer in Docker needs time)
});

// Auth interceptor to handle 401 Unauthorized (Session Expired/Invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Prevent redirect loops if already on login page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        console.warn('[API] Session expired or invalid (401). Redirecting to login.');

        // Determine correct login path based on context (fullstack or root)
        const loginPath = currentPath.startsWith('/fullstack') ? '/fullstack/login' : '/login';

        // Use window.location for hard redirect to ensure state is cleared
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

// Challenges (Legacy - still used for old system)
export const getChallenges = () => api.get('/challenges');
export const getChallenge = (id) => api.get(`/challenges/${id}`);

// Courses (New course-based system)
export const getCourses = (params = {}) => api.get('/courses', { params });
export const getCourse = (courseId) => api.get(`/courses/${courseId}`);
export const getCourseLevels = (courseId) => api.get(`/courses/${courseId}/levels`);
export const getLevelQuestions = (courseId, level, userId = 'default-user') =>
  api.get(`/courses/${courseId}/levels/${level}/questions?userId=${userId}`);
export const completeQuestion = (userId, data) => api.post(`/courses/progress/${userId}/complete`, data);
export const getUserProgress = (userId) => api.get(`/courses/progress/${userId}`);

// Course Management (Admin)
export const updateCourse = (courseId, course) => api.put(`/courses/${courseId}`, course);
export const createCourse = (course) => api.post('/courses', course);
export const deleteCourse = (courseId) => api.delete(`/courses/${courseId}`);
export const getCourseQuestions = (courseId) => api.get(`/courses/${courseId}/questions`);
export const updateQuestion = (questionId, question) => api.put(`/courses/questions/${questionId}`, question);
export const createQuestion = (courseId, question) => api.post(`/courses/${courseId}/questions`, question);
export const deleteQuestion = (questionId) => api.delete(`/courses/questions/${questionId}`);
export const bulkUploadQuestions = (courseId, questions) => api.post(`/courses/${courseId}/questions/bulk`, { questions });
export const bulkDeleteQuestions = (courseId, questionIds) => api.post(`/courses/${courseId}/questions/bulk-delete`, { questionIds });
export const getRandomQuestions = (courseId, level, count = 2) => api.get(`/courses/${courseId}/levels/${level}/randomize?count=${count}`);

// Level-specific question bank management
export const downloadLevelTemplate = (courseId, level) =>
  api.get(`/courses/${courseId}/levels/${level}/template`, { responseType: 'blob' });

export const downloadCsvTemplate = (courseId, level) =>
  api.get(`/courses/sample/csv${courseId && level ? `?courseId=${courseId}&level=${level}` : ''}`, { responseType: 'blob' });

export const uploadLevelQuestionBank = (courseId, level, questions, randomizeCount) =>
  api.post(`/courses/${courseId}/levels/${level}/questions/bulk`, { questions, randomizeCount });

// Course restrictions management
export const updateCourseRestrictions = (courseId, restrictions) =>
  api.put(`/courses/${courseId}/restrictions`, restrictions);
export const getCourseRestrictions = (courseId) =>
  api.get(`/courses/${courseId}/restrictions`);
export const getLevelSettings = (courseId) =>
  api.get(`/courses/${courseId}/level-settings`);

// Submissions
export const submitSolution = (data) => api.post('/submissions', data);
export const getSubmission = (id) => api.get(`/submissions/${id}`);
export const getSubmissionResult = (id) => api.get(`/submissions/${id}/result`);

// Evaluation
export const evaluateSolution = (submissionId) =>
  api.post('/evaluate', { submissionId });

export const quickEvaluate = (code, challengeId) =>
  api.post('/evaluate/quick', { code, challengeId });

// Admin
export const adminLogin = (credentials) =>
  api.post('/auth/login', credentials);

export const getAdminChallenges = () =>
  api.get('/admin/challenges');

export const createChallenge = (challenge) =>
  api.post('/admin/challenges', challenge);

export const updateChallenge = (id, challenge) =>
  api.put(`/admin/challenges/${id}`, challenge);

export const deleteChallenge = (id) =>
  api.delete(`/admin/challenges/${id}`);

export const getAllSubmissions = () =>
  api.get('/admin/submissions');

export const reEvaluateSubmission = (id) =>
  api.post(`/admin/evaluate/${id}`);

export const deleteSubmission = (id) =>
  api.delete(`/admin/submissions/${id}`);

export const getUserSubmissions = (userId) =>
  api.get(`/submissions/user/${userId}`);

// Admin Level Reset
export const resetLevel = (userId, courseId, level) =>
  api.post('/admin/reset-level', { userId, courseId, level });

export const completeLevel = (data) => api.post('/users/complete-level', data);
export const bulkCompleteLevel = (data) => api.post('/users/bulk-complete', data);


export const getViolations = () => api.get('/attendance/violations');
export const unlockTest = (attendanceId, action) => api.post('/attendance/unlock', { attendanceId, action });

// Code Execution (Node.js)
api.executeCode = (code, files = {}, language = 'nodejs', stdin = "") =>
  api.post('/execute', { code, files, language, stdin });

api.evaluateCode = (code, files, expectedOutput) =>
  api.post('/execute/evaluate', { code, files, expectedOutput });

export default api;
