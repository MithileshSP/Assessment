import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import {
    User,
    Mail,
    Shield,
    LogOut,
    Calendar,
    Settings,
    Bell,
    ChevronRight,
    Lock
} from 'lucide-react';
import { clearAdminSession } from '../utils/session';

const UserProfile = () => {
    const navigate = useNavigate();
    const userData = (() => {
        try {
            const stored = localStorage.getItem('user');
            if (stored) return JSON.parse(stored);
            return {
                username: localStorage.getItem('username') || 'User',
                fullName: localStorage.getItem('fullName') || 'Student',
                rollNo: localStorage.getItem('rollNo'),
                email: 'user@example.com',
                role: 'student'
            };
        } catch (e) {
            return { username: 'User', fullName: 'System User', role: 'student' };
        }
    })();

    const handleLogout = () => {
        navigate('/logout');
    };

    return (
        <SaaSLayout>
            <div className="max-w-4xl mx-auto space-y-8 text-left">
                {/* Profile Header */}
                <div className="flex flex-col md:flex-row items-center gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-blue-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-blue-600/30">
                        {(userData.fullName || userData.username || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                            <h1 className="text-3xl font-black text-slate-900">{userData.fullName || userData.username || 'System User'}</h1>
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-widest">{userData.role}</span>
                        </div>
                        <p className="text-slate-500 font-medium">@{userData.username}</p>
                        {userData.rollNo && (
                            <p className="text-slate-500 font-bold uppercase tracking-wider text-sm mt-1">{userData.rollNo}</p>
                        )}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mt-6">
                            <div className="flex items-center gap-2 text-slate-400 font-medium text-sm">
                                <Mail size={16} />
                                {userData.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 font-medium text-sm">
                                <Calendar size={16} />
                                Joined {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold flex items-center gap-2 hover:bg-rose-100 transition-all border border-rose-100/50"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default UserProfile;
