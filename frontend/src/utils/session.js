const SESSION_EVENT = 'portal-session-change';

// DEPRECATED: These functions read from localStorage for backward compatibility
// New code should use useAuth() from AuthContext instead
export const getUserRole = () => {
  // Fallback for non-React contexts — will be empty after full migration
  return '';
};

export const isAdminSessionActive = () => {
  // Deprecated: use useAuth().isAdmin instead
  return false;
};

export const notifySessionChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
};

export const clearAdminSession = () => {
  // Clear all localStorage items (still needed for cleanup during migration)
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  localStorage.removeItem('userToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('user');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  localStorage.removeItem('fullName');
  localStorage.removeItem('rollNo');
  notifySessionChange();
};

export const subscribeToSessionChanges = (callback) => {
  if (typeof window === 'undefined') return () => { };
  const handler = () => callback();
  window.addEventListener(SESSION_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SESSION_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
};
