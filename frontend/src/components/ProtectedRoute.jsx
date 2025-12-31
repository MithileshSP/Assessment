import { Navigate } from 'react-router-dom';

// Protected Route Component - Requires user to be logged in
export default function ProtectedRoute({ children }) {
  const userId = localStorage.getItem('userId');
  const userToken = localStorage.getItem('userToken');
  const adminToken = localStorage.getItem('adminToken');
  const userRole = localStorage.getItem('userRole');
  
  // If no user is logged in, redirect to login page
  // Allow access if either:
  // 1. User has both userId and userToken (normal user login)
  // 2. User has userId, adminToken, and admin role (admin login)
  const isAuthenticated = userId && (userToken || (adminToken && userRole === 'admin'));
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // User is logged in, allow access
  return children;
}
