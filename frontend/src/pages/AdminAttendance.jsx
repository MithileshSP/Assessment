import React, { useState, useEffect, useRef } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api, { BASE_URL } from '../services/api';
import {
    Activity,
    Lock,
    Unlock,
    Search,
    Download,
    Upload,
    Plus,
    RefreshCw,
    X,
    FileSpreadsheet,
    CheckCircle,
    Trash2,
    Shield,
    Monitor,
    Clock,
    ChevronRight,
    ArrowLeft,
    Users,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import ToastContainer from '../components/Toast';
import { formatIST, formatFullIST } from '../utils/date';


const AdminAttendance = () => {
    const [unblockedUsers, setUnblockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPolling, setIsPolling] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [totalUsers, setTotalUsers] = useState(0);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [bulkEmails, setBulkEmails] = useState('');
    const [toasts, setToasts] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [scheduledStudents, setScheduledStudents] = useState([]);
    const [studentListTab, setStudentListTab] = useState('active');
    const [isBulkExpanded, setIsBulkExpanded] = useState(false);
    const [sessionSearchQuery, setSessionSearchQuery] = useState('');
    const fileInputRef = useRef(null);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const fetchActiveSessions = async () => {
        try {
            const res = await api.get('/attendance/active-sessions');
            setActiveSessions(res.data);
        } catch (error) {
            console.error("Failed to load active sessions", error);
        }
    };

    const fetchScheduledStudents = async (sessionId) => {
        if (!sessionId) return;
        try {
            const res = await api.get(`/attendance/scheduled/${sessionId}`);
            setScheduledStudents(res.data);
        } catch (error) {
            console.error("Failed to load scheduled students", error);
        }
    };

    const fetchData = async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            setIsPolling(true);

            const [unblockedRes, statsRes] = await Promise.all([
                api.get('/attendance/unblocked-list'),
                api.get('/users?role=student&limit=1') // Just to get the total count quickly
            ]);

            setUnblockedUsers(unblockedRes.data);
            if (statsRes.data?.pagination?.total) {
                setTotalUsers(statsRes.data.pagination.total);
            }
            fetchActiveSessions();
            if (selectedSession) {
                fetchScheduledStudents(selectedSession.id);
            }

        } catch (error) {
            console.error("Failed to load attendance data", error);
            addToast("Failed to sync with server", "error");
        } finally {
            setLoading(false);
            setIsPolling(false);
        }
    };

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => {
            fetchData(false);
        }, 3000); // 3-second poll for "always in refresh" feel
        return () => clearInterval(interval);
    }, []);

    // Debounced search for Grant Access modal
    useEffect(() => {
        const fetchRegistryUsers = async () => {
            try {
                const response = await api.get('/users', {
                    params: {
                        role: 'student',
                        limit: 200,
                        search: searchQuery
                    }
                });

                if (response.data && response.data.users) {
                    setUsers(response.data.users);
                } else if (Array.isArray(response.data)) {
                    // Fallback for older API format
                    setUsers(response.data.slice(0, 200));
                }
            } catch (err) {
                console.error("Failed to fetch registry users:", err);
            }
        };

        const timer = setTimeout(() => {
            fetchRegistryUsers();
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch scheduled students when session is selected
    useEffect(() => {
        if (selectedSession) {
            fetchScheduledStudents(selectedSession.id);
        } else {
            setScheduledStudents([]);
        }
    }, [selectedSession]);

    const handleToggleBlock = async (userId, currentState) => {
        // OPTIMISTIC UI UPDATE
        const updatedUsers = unblockedUsers.filter(u => u.id !== userId);
        if (currentState === false) { // Means it was unblocked, now we are blocking
             setUnblockedUsers(updatedUsers);
        }
        
        try {
            setSubmitting(true);
            const params = selectedSession ? { sessionId: selectedSession.id } : {};
            const res = await api.patch(`/users/${userId}/toggle-block`, params);

            if (res.data.scheduled) {
                addToast('Student scheduled for this session', 'info');
            } else {
                addToast(currentState ? 'Student unblocked' : 'Student blocked', 'success');
            }
            
            fetchData();
        } catch (error) {
            addToast('Action failed', 'error');
            fetchData(); // Rollback by fetching fresh data
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelSchedule = async (userId) => {
        if (!selectedSession) return;
        try {
            setSubmitting(true);
            await api.delete(`/attendance/scheduled/${selectedSession.id}/${userId}`);
            addToast('Schedule cancelled', 'success');
            fetchData();
        } catch (error) {
            addToast('Failed to cancel schedule', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBulkUnblock = async () => {
        if (!bulkEmails.trim()) {
            addToast("Please provide emails", "error");
            return;
        }
        const emails = bulkEmails.split(/[\n,]+/).map(e => e.trim()).filter(e => e);
        try {
            setSubmitting(true);
            const res = await api.post('/users/bulk-unblock', {
                emails,
                sessionId: selectedSession?.id
            });
            addToast(`Bulk unblock complete: ${res.data.count} students.`, "success");
            setBulkEmails('');
            fetchData();
        } catch (e) {
            addToast("Bulk unblocking failed", "error");
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
            if (lines.length < 2) {
                addToast("CSV is empty or invalid", "error");
                return;
            }
            const headers = lines[0].toLowerCase().split(',');
            const emailIndex = headers.indexOf('email');

            if (emailIndex === -1) {
                addToast("CSV must have an 'email' column", "error");
                return;
            }

            const emails = lines.slice(1).map(line => line.split(',')[emailIndex]).filter(e => e);
            try {
                setSubmitting(true);
                const res = await api.post('/users/bulk-unblock', {
                    emails,
                    sessionId: selectedSession?.id
                });
                addToast(`Bulk unblock complete: ${res.data.count} students.`, "success");
                fetchData();
            } catch (err) {
                addToast("Bulk upload failed", "error");
            } finally {
                setSubmitting(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleDownloadTemplate = () => {
        window.open(`${BASE_URL}/attendance/sample/csv`, '_blank');
    };

    // --- RENDER HELPERS ---

    const [filterTab, setFilterTab] = useState('all');

    // --- RENDER HELPERS ---

    const filteredSessions = activeSessions.filter(s => {
        if (filterTab === 'all') return true;
        return s.status === filterTab;
    });

    if (!selectedSession) {
        return (
            <SaaSLayout fullWidth={true}>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
                <div className="min-h-screen bg-white">
                    {/* Professional Header */}
                    <div className="px-12 pt-12 pb-10 border-b border-slate-100 bg-slate-50/20">
                        <div className="max-w-[1600px] mx-auto flex items-end justify-between">
                            <div>
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-100">
                                        <Shield size={16} />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Attendance Management System
                                    </span>
                                </div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                                    Dashboard
                                </h1>
                                <p className="text-slate-500 font-medium text-base max-w-2xl text-left">
                                    Monitor real-time student activity and manage access permissions for current assessment sessions.
                                </p>
                            </div>

                            <div className="flex items-center gap-8 pb-1">
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Live Sessions</p>
                                    <p className="text-2xl font-bold text-slate-900">{activeSessions.filter(s => s.status === 'live').length}</p>
                                </div>
                                <div className="h-8 w-px bg-slate-200" />
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
                                    <div className="flex items-center gap-2 justify-end text-blue-600">
                                        <RefreshCw size={12} className={isPolling ? "animate-spin" : ""} />
                                        <span className="text-[11px] font-bold uppercase tracking-wider">Sync Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-12 py-10">
                        <div className="max-w-[1600px] mx-auto">
                            {/* Filter Tabs - Professional */}
                            <div className="flex items-center justify-between mb-8 border-b border-slate-100">
                                <div className="flex items-center gap-1">
                                    {['all', 'live', 'upcoming', 'ended'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setFilterTab(tab)}
                                            className={`px-8 py-4 text-[11px] font-bold uppercase tracking-widest transition-all relative group ${filterTab === tab
                                                ? 'text-blue-600'
                                                : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            <span className="relative z-10">{tab}</span>
                                            {filterTab === tab && (
                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-sm" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                    <Monitor size={12} /> Global View active
                                </div>
                            </div>

                            {/* Session Table - Refined */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/40 border-b border-slate-200/80">
                                            <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-2/5">Session Details</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schedule</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/80">
                                        {filteredSessions.map((session) => (
                                            <tr
                                                key={session.id}
                                                onClick={() => session.status !== 'ended' && setSelectedSession(session)}
                                                className={`group transition-all duration-200 ${session.status === 'ended'
                                                    ? 'opacity-60 grayscale cursor-not-allowed'
                                                    : 'hover:bg-blue-50/20 cursor-pointer'
                                                    }`}
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className={`w-2 h-2 rounded-full ${session.status === 'live' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                                            session.status === 'upcoming' ? 'bg-amber-500' : 'bg-slate-300'
                                                            }`} />
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-lg transition-colors group-hover:text-blue-600">
                                                                {session.session_name}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                                    ID: {session.id}
                                                                </span>
                                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                                                                    {session.course_title || 'General Monitoring'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase tracking-widest group-hover:border-blue-100 group-hover:text-blue-600 transition-all">
                                                        {session.mode}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-0.5 font-medium text-slate-600">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Clock size={14} className="text-slate-300" />
                                                            {formatIST(session.start_time)} - {formatIST(session.end_time)}
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Duration: {session.duration_minutes} min</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${session.status === 'live' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                        session.status === 'upcoming' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'
                                                        }`}>
                                                        {session.status}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className={`w-10 h-10 rounded-md flex items-center justify-center transition-all ${session.status === 'ended'
                                                        ? 'text-slate-200'
                                                        : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white group-hover:shadow-sm'
                                                        }`}>
                                                        <ChevronRight size={18} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {filteredSessions.length === 0 && (
                                    <div className="py-24 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-6 text-slate-200">
                                            <Activity size={32} />
                                        </div>
                                        <p className="text-slate-900 font-bold text-lg mb-1">No sessions found</p>
                                        <p className="text-slate-400 text-sm">Adjust your filters to see {filterTab !== 'all' ? filterTab : ''} assessment sessions.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Stats - Compact */}
                            <div className="mt-12 grid grid-cols-3 gap-6">
                                {[
                                    { label: 'Registered Capacity', value: totalUsers, icon: Users },
                                    { label: 'Monitoring Policy', value: 'Active', icon: Shield },
                                    { label: 'Uptime', value: '100.0%', icon: Activity }
                                ].map((stat, i) => (
                                    <div key={i} className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                                <stat.icon size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                                                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </SaaSLayout>
        );
    }


    // ... (rest of the file content until we hit the modal part)

    const safeUsers = Array.isArray(users) ? users : [];

    return (
        <SaaSLayout fullWidth={true}>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <div className="min-h-screen bg-white">
                {/* Professional Monitoring Header */}
                <div className="bg-slate-900 px-12 py-8">
                    {/* ... (header content remains same) ... */}
                    <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center text-white hover:bg-white hover:text-slate-900 transition-all active:scale-95 group border border-white/10"
                            >
                                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            </button>
                            <div>
                                <div className="flex items-center gap-3 mb-1.5">
                                    <div className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-wider text-blue-400">
                                        Live Terminal
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                                        Pool ID: {selectedSession?.id || 'GLOBAL'}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight leading-none">
                                    {selectedSession?.title || `Level ${selectedSession?.level || '?'} Monitoring`}
                                </h1>
                                <p className="text-slate-400 font-medium text-sm mt-1">
                                    {selectedSession?.course_title || 'General Session'} • {selectedSession?.mode || 'Unknown'} Policy
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex bg-white/5 border border-white/10 p-1 rounded-lg mr-2">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all rounded-md hover:bg-white/5"
                                >
                                    Template
                                </button>
                                <button
                                    onClick={() => fileInputRef.current.click()}
                                    className="px-4 py-2 text-[10px] font-black text-white bg-blue-600 hover:bg-blue-700 uppercase tracking-widest transition-all rounded-md flex items-center gap-2 shadow-sm animate-pulse"
                                >
                                    <Upload size={12} /> CSV Upload
                                </button>
                            </div>

                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleCsvUpload} />

                            <button
                                onClick={() => setShowManualModal(true)}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all hover:bg-blue-700 shadow-sm flex items-center gap-2 active:scale-95"
                            >
                                <Plus size={16} /> Manual Unblock
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-12 py-10 bg-slate-50/20">
                    <div className="max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
                        {/* Sidebar - Refined */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Collapsible Bulk Provisioning */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => setIsBulkExpanded(!isBulkExpanded)}
                                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                            <FileSpreadsheet size={16} />
                                        </div>
                                        <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">
                                            Bulk Provisioning
                                        </h3>
                                    </div>
                                    {isBulkExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                </button>

                                {isBulkExpanded && (
                                    <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                                        <textarea
                                            value={bulkEmails}
                                            onChange={(e) => setBulkEmails(e.target.value)}
                                            rows={8}
                                            placeholder="Student emails (one per line)..."
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-md text-xs font-medium focus:outline-none focus:bg-white focus:border-blue-600 transition-all resize-none mb-4 placeholder:text-slate-300"
                                        />
                                        <button
                                            onClick={handleBulkUnblock}
                                            disabled={submitting || !bulkEmails.trim()}
                                            className="w-full py-3 bg-slate-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                                        >
                                            {submitting ? 'Processing...' : 'Sync Registry'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Refined Metrics */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Terminal Stats</h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Active Pool</p>
                                            <p className="text-[10px] text-slate-400 font-medium">currently unblocked</p>
                                        </div>
                                        <span className="text-3xl font-bold text-slate-900">{unblockedUsers.length}</span>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Scheduled</p>
                                            <p className="text-[10px] text-slate-400 font-medium">pending session</p>
                                        </div>
                                        <span className="text-3xl font-bold text-slate-900">{scheduledStudents.filter(s => s.scheduled_status === 'scheduled').length}</span>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">In Progress</p>
                                            <p className="text-[10px] text-slate-400 font-medium">currently writing</p>
                                        </div>
                                        <span className="text-3xl font-bold text-slate-900">
                                            {selectedSession ? 
                                                unblockedUsers.filter(u => u.session_id == selectedSession.id && u.attempt_started_at && !u.attempt_submitted_at && !u.is_used).length :
                                                unblockedUsers.filter(u => u.attempt_started_at && !u.attempt_submitted_at && !u.is_used).length
                                            }
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Completed</p>
                                            <p className="text-[10px] text-slate-400 font-medium">hand-ins received</p>
                                        </div>
                                        <span className="text-3xl font-bold text-slate-900">
                                            {selectedSession ? 
                                                /* Include both submitted and expired for the session */
                                                [...unblockedUsers.filter(u => u.session_id == selectedSession.id && (u.is_used || u.attempt_submitted_at)),
                                                 ...scheduledStudents.filter(s => s.scheduled_status === 'expired')].length :
                                                unblockedUsers.filter(u => u.is_used || u.attempt_submitted_at).length
                                            }
                                        </span>
                                    </div>

                                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Active Sync</span>
                                        </div>
                                        {isPolling ? (
                                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider px-1.5 py-0.5 bg-blue-50 rounded animate-pulse">Syncing...</span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider px-1.5 py-0.5 bg-emerald-50 rounded">Live</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Workspace - Student Tables */}
                        <div className="lg:col-span-3 space-y-8">
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden min-h-[600px] flex flex-col shadow-sm">
                                {/* Professional Tab System */}
                                <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/30 gap-4">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setStudentListTab('active')}
                                            className={`px-6 py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${studentListTab === 'active'
                                                ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100'
                                                : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            <CheckCircle size={16} />
                                            Active Access
                                        </button>
                                        <button
                                            onClick={() => setStudentListTab('scheduled')}
                                            className={`px-6 py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${studentListTab === 'scheduled'
                                                ? 'bg-white text-amber-600 shadow-sm border border-amber-100'
                                                : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            <Clock size={16} />
                                            Scheduled
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search student..."
                                                value={sessionSearchQuery}
                                                onChange={(e) => setSessionSearchQuery(e.target.value)}
                                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[11px] font-medium focus:outline-none focus:border-blue-500 transition-all w-64 shadow-xs"
                                            />
                                        </div>
                                        {isPolling && (
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1 w-1 bg-blue-400 rounded-full animate-bounce" />
                                                <div className="h-1 w-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                                <div className="h-1 w-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-x-auto">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center h-full py-32 gap-3">
                                            <RefreshCw className="animate-spin text-blue-400" size={32} />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Updating Registry...</p>
                                        </div>
                                    ) : studentListTab === 'active' ? (
                                        /* Refined Active Students Table */
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-slate-50/20 border-b border-slate-100">
                                                    <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student Details</th>
                                                    <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                                                    <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Sync</th>
                                                    <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {unblockedUsers
                                                    .filter(u => !selectedSession || u.session_id == selectedSession.id)
                                                    .filter(u => {
                                                        const query = sessionSearchQuery.toLowerCase();
                                                        return (
                                                            u.full_name?.toLowerCase().includes(query) ||
                                                            u.email?.toLowerCase().includes(query) ||
                                                            u.roll_no?.toLowerCase().includes(query) ||
                                                            (u.is_used ? 'submitted' : (u.attempt_started_at ? 'writing' : 'waiting')).includes(query)
                                                        );
                                                    })
                                                    .map(user => {
                                                        const isWriting = user.attempt_started_at && !user.attempt_submitted_at && !user.is_used;
                                                        const isSubmitted = user.is_used || user.attempt_submitted_at;

                                                        return (
                                                            <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                                                                <td className="px-8 py-5">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                                                                            {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-slate-900 text-sm leading-tight">{user.full_name || user.username}</p>
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">ID: {user.roll_no || user.username}</p>
                                                                                {isWriting && (
                                                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-wider animate-pulse border border-blue-100">Writing</span>
                                                                                )}
                                                                                {isSubmitted && (
                                                                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-wider border border-emerald-100">Submitted</span>
                                                                                )}
                                                                                {!isWriting && !isSubmitted && (
                                                                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-black uppercase tracking-wider border border-slate-200">Waiting</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-5">
                                                                    <span className="text-sm text-slate-500 font-medium">{user.email || '-'}</span>
                                                                </td>
                                                                <td className="px-8 py-5">
                                                                    <div className="flex items-center gap-2 text-slate-400">
                                                                        <Monitor size={12} />
                                                                        <span className="text-[11px] font-medium">
                                                                            {user.attempt_submitted_at ? `Sub: ${formatIST(user.attempt_submitted_at)}` :
                                                                                user.attempt_started_at ? `Start: ${formatIST(user.attempt_started_at)}` :
                                                                                    (user.updated_at ? formatIST(user.updated_at) : 'Online')}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-5 text-right">
                                                                    <button
                                                                        onClick={() => handleToggleBlock(user.id, false)}
                                                                        className="px-6 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all border border-rose-100 active:scale-95 shadow-sm"
                                                                    >
                                                                        Revoke Access
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                {unblockedUsers.filter(u =>
                                                    u.full_name?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
                                                    u.email?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
                                                    u.roll_no?.toLowerCase().includes(sessionSearchQuery.toLowerCase())
                                                ).length === 0 && (
                                                        <tr>
                                                            <td colSpan="4" className="py-32 text-center">
                                                                <div className="max-w-xs mx-auto">
                                                                    <Search size={32} className="mx-auto mb-4 text-slate-200" />
                                                                    <h4 className="text-slate-900 font-bold text-base mb-1">
                                                                        {sessionSearchQuery ? 'No match found' : 'Access Restricted'}
                                                                    </h4>
                                                                    <p className="text-slate-400 text-sm">
                                                                        {sessionSearchQuery ? `No results for "${sessionSearchQuery}" in active pool.` : 'No students currently have active access for this assessment session.'}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    ) : (
                                        /* Refined Scheduled Students Table */
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-amber-50/20 border-b border-amber-50">
                                                    <th className="px-8 py-4 text-left text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Scheduled Student</th>
                                                    <th className="px-8 py-4 text-left text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Contact</th>
                                                    <th className="px-8 py-4 text-left text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Request Time</th>
                                                    <th className="px-8 py-4 text-right text-[10px] font-bold text-amber-600/70 uppercase tracking-wider text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-50/50">
                                                {scheduledStudents
                                                    .filter(s => s.scheduled_status === 'scheduled')
                                                    .filter(u =>
                                                        u.full_name?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
                                                        u.email?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
                                                        u.roll_no?.toLowerCase().includes(sessionSearchQuery.toLowerCase())
                                                    )
                                                    .map(student => (
                                                        <tr key={student.user_id} className="hover:bg-amber-50/10 transition-all group">
                                                            <td className="px-8 py-5">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-lg bg-amber-50/50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                                                                        {student.full_name?.charAt(0) || student.username?.charAt(0) || 'U'}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-900 text-sm leading-tight">{student.full_name || student.username}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <div className="w-1 h-1 rounded-full bg-amber-500" />
                                                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pre-authorized</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <span className="text-sm text-slate-500 font-medium">{student.email || '-'}</span>
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <span className="text-[11px] text-slate-500 font-medium lowercase">
                                                                    {student.requested_at ? formatFullIST(student.requested_at) : 'Queued'}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-5 text-right">
                                                                <button
                                                                    onClick={() => handleCancelSchedule(student.user_id)}
                                                                    className="px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md uppercase tracking-wider transition-all border border-transparent hover:border-rose-100"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {scheduledStudents.filter(s => s.scheduled_status === 'scheduled').filter(u =>
                                                    u.full_name?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
                                                    u.email?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
                                                    u.roll_no?.toLowerCase().includes(sessionSearchQuery.toLowerCase())
                                                ).length === 0 && (
                                                        <tr>
                                                            <td colSpan="4" className="py-32 text-center">
                                                                <div className="max-w-xs mx-auto">
                                                                    <Search size={32} className="mx-auto mb-4 text-amber-200" />
                                                                    <h4 className="text-slate-900 font-bold text-base mb-1">
                                                                        {sessionSearchQuery ? 'No match found' : 'Queue Empty'}
                                                                    </h4>
                                                                    <p className="text-slate-400 text-sm">
                                                                        {sessionSearchQuery ? `No results for "${sessionSearchQuery}" in scheduled list.` : 'No students are currently scheduled for future session activation.'}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Manual Unblock Modal - Enterprise Redesign */}
                {showManualModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-left flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Manual Authorization</h3>
                                    <p className="text-slate-500 font-medium text-[11px] mt-1 italic text-blue-600">Quick-release for blocked students</p>
                                </div>
                                <button
                                    onClick={() => setShowManualModal(false)}
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 flex flex-col h-full overflow-hidden">
                                <div className="relative mb-6">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Search size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by name, email or roll number..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="overflow-y-auto space-y-2 pr-2 flex-1 custom-scrollbar min-h-[300px]">
                                    {users.length > 0 ? (
                                        users.map(user => (
                                            <div key={user.id} className={`p-4 rounded-xl border flex items-center justify-between group transition-all mb-2 shadow-sm ${!user.isBlocked ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 shadow-slate-200/50'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-xs shadow-inner group-hover:scale-110 transition-transform ${!user.isBlocked ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                                        {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm leading-tight">{user.full_name || user.username}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border tracking-wider ${!user.isBlocked ? 'bg-emerald-100 text-emerald-700 border-emerald-200/50' : 'bg-blue-50 text-blue-600 border-blue-100/50'}`}>ROLL: {user.rollNo || user.roll_no || 'N/A'}</span>
                                                            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{user.email || 'No Email'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {user.isBlocked ? (
                                                    <button
                                                        onClick={() => {
                                                            handleToggleBlock(user.id, true);
                                                        }}
                                                        disabled={submitting}
                                                        className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                                                    >
                                                        Authorize
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-emerald-600 px-4">
                                                        <CheckCircle size={14} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                                                <Search size={24} className="text-slate-200" />
                                            </div>
                                            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">No blocked students found</p>
                                            <p className="text-slate-400 text-[10px] mt-2 font-medium">Try searching by name or roll number</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setShowManualModal(false)}
                                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-lg transition-all shadow-sm"
                                >
                                    Finish
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
                @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .animate-pulse-soft { animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            `}} />
        </SaaSLayout>
    );
};

export default AdminAttendance;
