import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAdminSession } from '../utils/session';
import { LogOut } from 'lucide-react';

const Logout = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Simple logic to clear everything and redirect
        const timer = setTimeout(() => {
            clearAdminSession();
            localStorage.removeItem('userToken');
            localStorage.removeItem('userRole');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            window.dispatchEvent(new Event('portal-session-change'));
            navigate('/login');
        }, 1500);

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
