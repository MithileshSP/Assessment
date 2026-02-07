import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clearAdminSession } from '../utils/session';
import api from '../services/api';

const Logout = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const performLogout = async () => {
            try {
                // Call backend to clear the cookie and invalidate session in DB
                await api.post('/auth/logout');
            } catch (err) {
                console.error('Logout error:', err);
            } finally {
                // Cleanup local storage (even if API fails)
                clearAdminSession();
                localStorage.removeItem('userToken');
                localStorage.removeItem('userRole');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                window.dispatchEvent(new Event('portal-session-change'));
                navigate('/login');
            }
        };

        const timer = setTimeout(performLogout, 1500);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="text-center space-y-6 max-w-sm">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto text-rose-500 shadow-xl shadow-rose-500/10 border border-slate-100">
                    <LogOut size={40} className="animate-pulse" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">Signing Out</h1>
                    <p className="text-slate-500 font-medium">Securing your session and redirecting you to terminal entrance...</p>
                </div>
                <div className="flex justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce" />
                </div>
            </div>
        </div>
    );
};

export default Logout;
