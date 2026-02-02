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
    Shield
} from 'lucide-react';
import ToastContainer from '../components/Toast';

const AdminAttendance = () => {
    const [unblockedUsers, setUnblockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPolling, setIsPolling] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [bulkEmails, setBulkEmails] = useState('');
    const [toasts, setToasts] = useState([]);
    const fileInputRef = useRef(null);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const fetchData = async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            setIsPolling(true);

            const [unblockedRes, usersRes] = await Promise.all([
                api.get('/attendance/unblocked-list'),
                api.get('/users?role=student')
            ]);

            setUnblockedUsers(unblockedRes.data);
            setUsers(usersRes.data);

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
        const interval = setInterval(() => fetchData(false), 5000);
        return () => clearInterval(interval);
    }, []);

    const handleToggleBlock = async (userId, currentState) => {
        try {
            setSubmitting(true);
            await api.patch(`/users/${userId}/toggle-block`);
            addToast(currentState ? 'Student unblocked' : 'Student blocked', 'success');
            // Immediate UI update while waiting for poll
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: !currentState } : u));
            fetchData();
        } catch (error) {
            addToast('Failed to toggle status', 'error');
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
            const res = await api.post('/users/bulk-unblock', { emails });
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
                const res = await api.post('/users/bulk-unblock', { emails });
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

    return (
        <SaaSLayout>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <div className="min-h-screen bg-slate-50/30 -m-8 p-8 font-sans antialiased text-slate-900">
                {/* Header Section */}
                <div className="max-w-7xl mx-auto mb-8 text-left">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="text-indigo-600" size={24} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                    Access Management Console
                                </span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900">Attendance Monitoring</h1>
                            <p className="text-slate-500 font-medium">Manage student permissions and track live portal access.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDownloadTemplate}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-all hover:bg-slate-50 flex items-center gap-2"
                            >
                                <Download size={14} /> Template
                            </button>
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-lg text-xs font-bold uppercase transition-all hover:bg-slate-50 flex items-center gap-2"
                            >
                                <Upload size={14} /> Upload CSV
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleCsvUpload} />
                            <button
                                onClick={() => setShowManualModal(true)}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase transition-all hover:bg-indigo-700 shadow-md flex items-center gap-2"
                            >
                                <Plus size={14} /> Unblock Manually
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Panel: Stats & Bulk */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileSpreadsheet size={16} /> Bulk Access Control
                            </h3>
                            <textarea
                                value={bulkEmails}
                                onChange={(e) => setBulkEmails(e.target.value)}
                                rows={8}
                                placeholder="Paste student emails (one per line)..."
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-600 transition-all resize-none mb-4"
                            />
                            <button
                                onClick={handleBulkUnblock}
                                disabled={submitting || !bulkEmails.trim()}
                                className="w-full py-3 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Updating...' : 'Grant Access'}
                            </button>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Portal Status</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Active Students</span>
                                    <span className="text-xl font-black text-indigo-600">{unblockedUsers.length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Blocked Pools</span>
                                    <span className="text-xl font-black text-slate-300">{users.length - unblockedUsers.length}</span>
                                </div>
                                <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Syncing</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content: List */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left min-h-[600px] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="text-indigo-600" size={20} />
                                    <h3 className="text-lg font-bold text-slate-800">Unblocked Student List</h3>
                                </div>
                                {isPolling && <RefreshCw size={16} className="text-slate-200 animate-spin" />}
                            </div>

                            <div className="flex-1 overflow-x-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full py-20">
                                        <RefreshCw className="animate-spin text-slate-300" size={32} />
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Details</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized At</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Revoke</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {unblockedUsers.map(user => (
                                                <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black border border-emerald-100/50">
                                                                {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm leading-tight">{user.full_name || user.username}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">ID: {user.roll_no || user.username}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs text-slate-500 font-medium">{user.email || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs text-slate-400 font-medium">
                                                            {user.updated_at ? new Date(user.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleToggleBlock(user.id, false)}
                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title="Immediately block access"
                                                        >
                                                            <Lock size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {unblockedUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="py-32 text-center">
                                                        <div className="max-w-xs mx-auto">
                                                            <Activity size={40} className="text-slate-200 mx-auto mb-4" />
                                                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No unblocked students found</p>
                                                            <p className="text-slate-300 text-[10px] mt-2 leading-relaxed">Students are blocked by default. Use the tools on the left or the manual button above to grant portal access.</p>
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

                {/* Manual Unblock Modal */}
                {showManualModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-left scale-in duration-200">
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Search & Authorize</h3>
                                    <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
                                </div>

                                <div className="relative mb-6">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Enter Name, Email or Roll No..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {users
                                        .filter(u =>
                                            u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            u.roll_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            u.username?.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .slice(0, 10)
                                        .map(user => (
                                            <div key={user.id} className="p-4 rounded-lg bg-white border border-slate-100 hover:border-indigo-100 flex items-center justify-between group transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-black border uppercase ${user.is_blocked ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                        {(user.full_name || user.username)[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{user.full_name || user.username}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{user.roll_no || user.username}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleBlock(user.id, user.is_blocked)}
                                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${user.is_blocked ? 'bg-indigo-600 text-white hover:bg-emerald-600 shadow-md flex items-center gap-2' : 'bg-slate-100 text-slate-400 cursor-default flex items-center gap-2'}`}
                                                    disabled={!user.is_blocked || submitting}
                                                >
                                                    {user.is_blocked ? (submitting ? '...' : 'Unblock') : <Unlock size={12} />}
                                                </button>
                                            </div>
                                        ))}
                                    {searchQuery && !users.some(u =>
                                        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        u.roll_no?.toLowerCase().includes(searchQuery.toLowerCase())
                                    ) && (
                                            <p className="py-8 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No matching students</p>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
                .scale-in { animation: scaleIn 0.2s ease-out; }
                @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}} />
        </SaaSLayout>
    );
};

export default AdminAttendance;
