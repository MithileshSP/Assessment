import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(true);

    // Verify session against the server using the HttpOnly cookie
    const verifySession = useCallback(async () => {
        try {
            const res = await api.get('/auth/me');
            const userData = res.data;
            setUser(userData);
            setRole((userData.role || '').toLowerCase());
            return userData;
        } catch (err) {
            // Session invalid or expired — clear state
            setUser(null);
            setRole('');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // On mount, verify the session from cookie
    useEffect(() => {
        verifySession();
    }, [verifySession]);

    // Listen for session change events (login/logout)
    useEffect(() => {
        const handler = () => verifySession();
        window.addEventListener('portal-session-change', handler);
        return () => window.removeEventListener('portal-session-change', handler);
    }, [verifySession]);

    // Called after successful login to update context immediately
    const onLoginSuccess = useCallback((userData) => {
        if (userData) {
            setUser(userData);
            setRole((userData.role || '').toLowerCase());
            setLoading(false);
        }
    }, []);

    // Called on logout to clear state
    const onLogout = useCallback(() => {
        setUser(null);
        setRole('');
    }, []);

    const isAuthenticated = !!user;
    const isAdmin = role === 'admin';
    const isFaculty = role === 'faculty';

    return (
        <AuthContext.Provider value={{
            user,
            role,
            loading,
            isAuthenticated,
            isAdmin,
            isFaculty,
            verifySession,
            onLoginSuccess,
            onLogout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
