import React, { useState, useEffect } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api, { BASE_URL } from '../services/api';
import {
    Calendar,
    Check,
    X,
    Clock,
    User,
    Briefcase,
    RefreshCw,
    Plus,
    Upload,
    Search,
    ChevronDown,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle
} from 'lucide-react';

const AdminAttendance = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPolling, setIsPolling] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [manualTarget, setManualTarget] = useState({ userId: '', courseId: '', level: '1' });
    const [searchQuery, setSearchQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [stats, setStats] = useState({ pending: 0, active: 0 });
    const [activeSession, setActiveSession] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedLevel, setSelectedLevel] = useState('1');
    const [sessionDuration, setSessionDuration] = useState('60');
    const [bulkUsernames, setBulkUsernames] = useState('');
    const [timeRemaining, setTimeRemaining] = useState(0);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (e) {
            console.error("Failed to load users", e);
        }
    };

    const fetchCourses = async () => {
        try {
            const res = await api.get('/courses');
            setCourses(res.data);
        } catch (e) {
            console.error("Failed to load courses", e);
        }
    };

    const fetchActiveSession = async () => {
        if (!selectedCourse || !selectedLevel) return;
        try {
            const res = await api.get('/admin/sessions/active', {
                params: { courseId: selectedCourse, level: selectedLevel }
            });
            setActiveSession(res.data);
        } catch (e) {
            console.error("Failed to fetch session", e);
        }
    };

    const fetchRequests = async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            setIsPolling(true);
            const res = await api.get('/attendance/requests');
            setRequests(res.data);
            setStats(prev => ({
                ...prev,
                pending: res.data.length
            }));

            // Also fetch active session if course/level selected
            if (selectedCourse && selectedLevel) {
                fetchActiveSession();
            }
        } catch (error) {
            console.error("Failed to load requests", error);
        } finally {
            setLoading(false);
            setIsPolling(false);
        }
    };

    useEffect(() => {
        fetchRequests(true);
        fetchUsers();
        fetchCourses();
        const interval = setInterval(() => fetchRequests(false), 5000);
        return () => clearInterval(interval);
    }, [selectedCourse, selectedLevel]);

    // Live countdown effect
    useEffect(() => {
        if (!activeSession) return;

        const updateTimer = () => {
            const end = new Date(activeSession.end_time).getTime();
            const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
            setTimeRemaining(left);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    const handleStartSession = async () => {
        if (!selectedCourse || !selectedLevel || !sessionDuration) {
            alert("Please select course, level and duration");
            return;
        }
        try {
            setSubmitting(true);
            await api.post('/admin/sessions/start', {
                courseId: selectedCourse,
                level: selectedLevel,
                duration: parseInt(sessionDuration)
            });
            alert("Global session started!");
            fetchActiveSession();
        } catch (e) {
            alert("Failed to start session: " + (e.response?.data?.error || e.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEndSession = async () => {
        if (!activeSession) return;
        if (!window.confirm("CRITICAL: Ending the session will lock all students out and auto-submit their work. Proceed?")) return;

        try {
            setSubmitting(true);
            await api.post('/admin/sessions/end', { sessionId: activeSession.id });
            alert("Session terminated successfully.");
            setActiveSession(null);
        } catch (e) {
            alert("Failed to end session");
        } finally {
            setSubmitting(false);
        }
    };

    const handleBulkSessionAuth = async () => {
        if (!activeSession || !bulkUsernames.trim()) {
            alert("No active session or usernames provided");
            return;
        }

        const usernames = bulkUsernames.split(/[\n,]+/).map(u => u.trim()).filter(u => u);
        if (usernames.length === 0) return;

        try {
            setSubmitting(true);
            const res = await api.post('/admin/sessions/bulk-authorize', {
                usernames,
                sessionId: activeSession.id
            });
            alert(`Bulk auth complete. Approved: ${res.data.results.approved}, Failed: ${res.data.results.failed}, Not Found: ${res.data.results.notFound.length}`);
            setBulkUsernames('');
            fetchRequests(true);
        } catch (e) {
            alert("Bulk authorization failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (requestId, action) => {
        try {
            await api.post('/attendance/approve', { requestId, action });
            setRequests(prev => prev.filter(r => r.id !== requestId));
            setStats(prev => ({ ...prev, pending: prev.pending - 1 }));
        } catch (error) {
            alert('Action failed');
            fetchRequests(true);
        }
    };
    const handleManualApprove = async () => {
        if (!manualTarget.userId || !manualTarget.courseId || !manualTarget.level) {
            alert("Please fill all fields");
            return;
        }
        try {
            setSubmitting(true);
            await api.post('/attendance/manual-approve', manualTarget);
            setShowManualModal(false);
            setManualTarget({ userId: '', courseId: '', level: '1' });
            alert("Authorized successfully");
            fetchRequests(true);
        } catch (error) {
            alert("Failed to authorize student");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCsvUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length < 2) return;
            const headers = lines[0].toLowerCase().split(',');
            const usernameIndex = headers.indexOf('username');

            if (usernameIndex === -1) {
                alert("CSV must have a 'username' column");
                return;
            }

            const usernames = lines.slice(1).map(line => {
                const parts = line.split(',');
                return parts[usernameIndex];
            }).filter(u => u);

            if (usernames.length === 0) {
                alert("No usernames found");
                return;
            }

            const courseId = prompt("Enter Course ID (e.g., course-fullstack):");
            const level = prompt("Enter Level Number:");

            if (!courseId || !level) return;

            try {
                setLoading(true);
                const res = await api.post('/attendance/bulk-approve', {
                    usernames,
                    courseId,
                    level: parseInt(level)
                });
                alert(`Processed. Approved: ${res.data.results.approved}, Not Found: ${res.data.results.notFound.length}`);
                fetchRequests(true);
            } catch (err) {
                alert("Bulk approval failed");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <SaaSLayout>
            <div className="min-h-screen bg-[#F8FAFC]/30 -m-8 p-8 font-sans antialiased text-slate-900">
                {/* --- Premium Header Section --- */}
                <div className="max-w-7xl mx-auto mb-10">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-10 border-b border-slate-200/60">
                        <div className="text-left">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                    <Clock size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                                    System Active • v2.1 (Global Sync)
                                </span>
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 mb-2">
                                Attendance Console
                            </h1>
                            <p className="text-slate-500 font-medium text-lg max-w-2xl">
                                Manage global synchronized exam sessions and bulk-authorize student access.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowManualModal(true)}
                                className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold text-sm tracking-tight transition-all hover:bg-slate-50 shadow-sm flex items-center gap-2"
                            >
                                <Plus size={18} />
                                <span>Add Student</span>
                            </button>
                        </div>
                    </div>

                    {/* --- Live Session & Quick Stats --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-10">
                        {/* Live Session Control Panel */}
                        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-left">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeSession ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        <Briefcase size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">Live Session Control</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Synchronization Center</p>
                                    </div>
                                </div>
                                {activeSession && (
                                    <div className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                        <RefreshCw size={12} />
                                        In Progress
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Course</label>
                                            <select
                                                value={selectedCourse}
                                                onChange={(e) => setSelectedCourse(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                                            >
                                                <option value="">Select Course</option>
                                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level</label>
                                            <select
                                                value={selectedLevel}
                                                onChange={(e) => setSelectedLevel(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                                            >
                                                {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>Level {l}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {!activeSession ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration (min)</label>
                                                <input
                                                    type="number"
                                                    value={sessionDuration}
                                                    onChange={(e) => setSessionDuration(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                                                    placeholder="60"
                                                />
                                            </div>
                                            <button
                                                onClick={handleStartSession}
                                                disabled={submitting || !selectedCourse}
                                                className="mt-6 w-full bg-slate-900 text-white rounded-xl font-bold text-sm tracking-tight hover:bg-indigo-600 transition-all disabled:opacity-50"
                                            >
                                                Start Session
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-slate-900 rounded-3xl text-white">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Live Session Countdown</p>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="text-3xl font-black text-indigo-400">
                                                    {(() => {
                                                        const m = Math.floor(timeRemaining / 60);
                                                        const s = timeRemaining % 60;
                                                        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                    })()}
                                                </div>
                                                <div className="text-right text-[10px] font-medium text-slate-400">
                                                    Starts: {new Date(activeSession.start_time).toLocaleTimeString()}<br />
                                                    Ends: {new Date(activeSession.end_time).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleEndSession}
                                                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                                            >
                                                Terminate Exam
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2 text-left">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BULK Authorization {activeSession ? `(SessionID: ${activeSession.id})` : '(No Active Session)'}</label>
                                        <textarea
                                            value={bulkUsernames}
                                            onChange={(e) => setBulkUsernames(e.target.value)}
                                            rows={4}
                                            placeholder="Enter student usernames (comma or newline separated)..."
                                            className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-medium focus:bg-white focus:border-indigo-600 outline-none transition-all resize-none shadow-inner"
                                            disabled={!activeSession}
                                        />
                                    </div>
                                    <button
                                        onClick={handleBulkSessionAuth}
                                        disabled={!activeSession || submitting || !bulkUsernames.trim()}
                                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm tracking-tight hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-20"
                                    >
                                        Authorize Group
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats Sidebar */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-left">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">Pending Approval</span>
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-black text-slate-900">{stats.pending}</span>
                                    <span className="text-slate-400 font-bold mb-2 uppercase text-[10px]">Requests</span>
                                </div>
                            </div>
                            <div className="bg-indigo-600 p-6 rounded-[2rem] text-white text-left relative overflow-hidden">
                                <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                                <span className="text-xs font-bold text-white/60 uppercase tracking-widest block mb-4">Exam Mode</span>
                                <div className="text-2xl font-black leading-tight mb-2">College Grade Enforcement</div>
                                <p className="text-white/70 text-xs font-medium">Automatic re-authorization required per attempt.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Main Content Section --- */}
                <div className="max-w-7xl mx-auto bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                    <div className="p-10">
                        <div className="flex items-center justify-between mb-10 text-left">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 mb-1">Authorization Queue</h2>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Real-time Approval Processing</p>
                            </div>
                            {isPolling && (
                                <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-[10px] font-bold text-indigo-600 uppercase tracking-widest transition-all">
                                    <RefreshCw size={12} className="animate-spin" />
                                    Live Syncing
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <div className="py-32 flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Accessing secure database...</span>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="py-24 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                <div className="w-20 h-20 bg-white shadow-sm rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                                    <Clock size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400 mb-2">No active requests</h3>
                                <p className="text-slate-400 text-sm max-w-xs mx-auto">Candidates will appear here once they request authorization for an assessment.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto text-left">
                                <table className="w-full border-separate border-spacing-y-4">
                                    <thead>
                                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">
                                            <th className="pb-4 pl-6">Candidate</th>
                                            <th className="pb-4">Assessment Path</th>
                                            <th className="pb-4">Request Log</th>
                                            <th className="pb-4 pr-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.map((req) => (
                                            <tr key={req.id} className="group bg-white hover:bg-slate-50/80 transition-all border border-slate-100">
                                                <td className="py-6 pl-6 rounded-l-[1.5rem]">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm uppercase shadow-sm group-hover:bg-white transition-colors">
                                                            {(req.full_name || req.username || 'U')[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{req.full_name || 'Candidate'}</p>
                                                            <p className="text-xs text-slate-400 font-medium tracking-tight">@{req.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 text-left">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">
                                                            {req.test_identifier?.split('_')[0] || 'Logic Assessment'}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                                Level {req.test_identifier?.split('_')[1] || '1'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 text-left">
                                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                                        <Clock size={12} />
                                                        {new Date(req.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="py-6 pr-6 text-right rounded-r-[1.5rem]">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleAction(req.id, 'reject')}
                                                            className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                            title="Reject Request"
                                                        >
                                                            <X size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(req.id, 'approve')}
                                                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm tracking-tight hover:bg-emerald-600 hover:scale-105 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                                                        >
                                                            <Check size={16} />
                                                            <span>Approve</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Direct Authorization Modal (Glassmorphism Redesign) --- */}
                {showManualModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
                            onClick={() => setShowManualModal(false)}
                        />
                        <div className="relative bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] border border-white/50 overflow-hidden animate-zoom-in text-left">
                            <div className="p-10">
                                {/* Modal Header */}
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-slate-900/20">
                                        <Plus size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Direct Authorization</h3>
                                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Manual Credential Verification</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Student Search Area */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">1. Identify Candidate</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Search by full name or ID..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setManualTarget(prev => ({ ...prev, userId: '' }));
                                                }}
                                                className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-[1.25rem] text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner"
                                            />
                                        </div>

                                        {/* Found Candidates Grid */}
                                        <div className="mt-3 max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {users
                                                .filter(u => u.role === 'student' && (
                                                    (u.fullName || u.full_name || '')?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    (u.username || '')?.toLowerCase().includes(searchQuery.toLowerCase())
                                                ))
                                                .slice(0, 10)
                                                .map(user => (
                                                    <div
                                                        key={user.id}
                                                        onClick={() => {
                                                            setManualTarget(prev => ({ ...prev, userId: user.id }));
                                                            setSearchQuery(user.fullName || user.full_name || user.username);
                                                        }}
                                                        className={`p-4 rounded-2xl border-2 flex items-center gap-4 cursor-pointer transition-all ${manualTarget.userId === user.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-50 hover:bg-slate-50/80 hover:border-slate-100'
                                                            }`}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xs font-black shadow-sm text-slate-400 text-left">
                                                            {((user.fullName || user.full_name || user.username) || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="text-sm font-black text-slate-900">{user.fullName || user.full_name || user.username}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">@{user.username}</p>
                                                        </div>
                                                        {manualTarget.userId === user.id && (
                                                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                                                                <Check size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Configuration Selects */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">2. Target Course</label>
                                            <select
                                                value={manualTarget.courseId}
                                                onChange={(e) => setManualTarget(prev => ({ ...prev, courseId: e.target.value }))}
                                                className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none outline-none"
                                            >
                                                <option value="">Select Curriculum</option>
                                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">3. Level</label>
                                            <select
                                                value={manualTarget.level}
                                                onChange={(e) => setManualTarget(prev => ({ ...prev, level: e.target.value }))}
                                                className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none outline-none"
                                            >
                                                {[1, 2, 3, 4, 5].map(lv => <option key={lv} value={lv}>Stage {lv}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Modal Actions */}
                                    <div className="flex items-center gap-3 pt-4">
                                        <button
                                            onClick={() => setShowManualModal(false)}
                                            className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-bold text-sm hover:bg-slate-200 transition-all"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            onClick={handleManualApprove}
                                            disabled={!manualTarget.userId || !manualTarget.courseId || submitting}
                                            className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black text-sm tracking-widest uppercase hover:bg-indigo-600 disabled:opacity-20 disabled:hover:bg-slate-900 transition-all shadow-2xl shadow-slate-900/10"
                                        >
                                            {submitting ? 'Processing...' : 'Execute Authorization'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* --- Global Utility Styles --- */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes zoom-in {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .animate-zoom-in { animation: zoom-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
            `}} />
        </SaaSLayout>
    );
};

export default AdminAttendance;
