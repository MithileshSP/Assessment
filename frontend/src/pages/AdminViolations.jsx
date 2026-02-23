import React, { useState, useEffect, useCallback } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import { getViolations, unlockTest, BASE_URL } from '../services/api';
import {
    AlertTriangle,
    Play,
    CheckCircle,
    Clock,
    User,
    Hash,
    ShieldAlert,
    RefreshCw,
    Search,
    X,
    Monitor
} from 'lucide-react';
import ToastContainer from '../components/Toast';

const AdminViolations = () => {
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toasts, setToasts] = useState([]);
    const [selectedViolation, setSelectedViolation] = useState(null);
    const [imgError, setImgError] = useState(false);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    useEffect(() => {
        setImgError(false);
    }, [selectedViolation]);

    const fetchViolations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getViolations();
            setViolations(response.data || []);
        } catch (error) {
            console.error('Failed to fetch violations:', error);
            addToast('Failed to load violations', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchViolations();
        // Poll every 30 seconds
        const interval = setInterval(fetchViolations, 30000);
        return () => clearInterval(interval);
    }, [fetchViolations]);

    const handleAction = async (attendanceId, action, studentName) => {
        try {
            await unlockTest(attendanceId, action);
            addToast(`Student ${studentName} ${action === 'continue' ? 'allowed to continue' : 'test finished'}`);
            setSelectedViolation(null);
            fetchViolations();
        } catch (error) {
            console.error(`Failed to ${action} test:`, error);
            addToast(`Failed to ${action} test`, 'error');
        }
    };

    const filteredViolations = violations.filter(v =>
        (v.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.roll_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <SaaSLayout>
            <div className="space-y-8 animate-fade-in">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 text-rose-600 mb-2">
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <ShieldAlert size={20} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest">Security Protocol</span>
                        </div>
                        <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">
                            Active Violations
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">Manage frozen tests and security exceptions</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchViolations}
                            className="btn-secondary h-12 px-6 flex items-center gap-2 group"
                            disabled={loading}
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                            Refresh List
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card p-6 border-l-4 border-rose-500">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                                <AlertTriangle size={24} />
                            </div>
                            <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-widest">Urgent</span>
                        </div>
                        <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Frozen Tests</h3>
                        <p className="text-3xl font-display font-bold text-slate-900">{violations.length}</p>
                    </div>

                    <div className="card p-6 border-l-4 border-amber-500">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                                <Hash size={24} />
                            </div>
                        </div>
                        <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Total Deviations</h3>
                        <p className="text-3xl font-display font-bold text-slate-900">
                            {violations.reduce((acc, v) => acc + (v.violation_count || 0), 0)}
                        </p>
                    </div>

                    <div className="card p-6 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                                <Clock size={24} />
                            </div>
                        </div>
                        <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Avg. Response Time</h3>
                        <p className="text-3xl font-display font-bold text-slate-900">Live</p>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="card p-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name, roll number, or username..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Violations Table */}
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Student Details</th>
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Violations</th>
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Reason & Time</th>
                                    <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading && violations.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500 font-medium">
                                            <RefreshCw className="animate-spin mx-auto mb-4 text-primary-600" size={32} />
                                            Scanning for violations...
                                        </td>
                                    </tr>
                                ) : filteredViolations.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center">
                                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <CheckCircle size={32} />
                                            </div>
                                            <p className="text-slate-900 font-bold text-lg mb-1">All Clear</p>
                                            <p className="text-slate-500">No active violations detected at this time.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredViolations.map((v) => (
                                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-display font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                                        {(v.full_name || v.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 leading-none mb-1.5">{v.full_name || v.username}</p>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                            <User size={12} />
                                                            {v.roll_no || 'No Roll No'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-display font-bold text-lg ${v.violation_count > 3 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                    {v.violation_count}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                                        <AlertTriangle size={14} className="text-rose-500" />
                                                        {v.locked_reason}
                                                    </p>
                                                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                                        <Clock size={12} />
                                                        {new Date(v.locked_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <button
                                                    onClick={() => setSelectedViolation(v)}
                                                    className="h-10 px-6 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                                                >
                                                    Review
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Violation Review Modal */}
            {selectedViolation && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-slate-100">
                        <div className="h-1.5 bg-rose-500 w-full" />

                        <div className="p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="px-2 py-0.5 bg-rose-50 border border-rose-100 rounded text-[9px] font-black uppercase tracking-[0.1em] text-rose-600">
                                            Security Incident
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 border-l border-slate-200">
                                            Case #{selectedViolation.id}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Violation Review</h2>
                                </div>
                                <button
                                    onClick={() => setSelectedViolation(null)}
                                    className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors border border-slate-100 hover:bg-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Student Profile - More Compact */}
                            <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-white font-display font-bold text-xl shadow-md border-2 border-white">
                                    {(selectedViolation.full_name || selectedViolation.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-base font-bold text-slate-900 leading-tight">
                                        {selectedViolation.full_name || selectedViolation.username}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedViolation.roll_no || 'N/A'}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[150px]">{selectedViolation.email || 'No Email'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-6 mb-8">
                                {/* Compact Summary - 4/12 */}
                                <div className="col-span-4 space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Integrity Summary</p>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Reason</p>
                                                <p className="text-xs font-bold text-rose-600 leading-tight bg-rose-50 p-2 rounded-lg border border-rose-100">
                                                    {selectedViolation.locked_reason}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Hits</p>
                                                <p className="text-2xl font-display font-black text-rose-700 leading-none">
                                                    {selectedViolation.violation_count}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Time</p>
                                                <p className="text-xs font-bold text-slate-600">
                                                    {new Date(selectedViolation.locked_at).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Breakdown List - 8/12 */}
                                <div className="col-span-8">
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Detail Violation Log</span>
                                            <ShieldAlert size={14} className="text-rose-500" />
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {[
                                                { label: 'Copy Protected Content', count: selectedViolation.copy_count, icon: <Hash size={12} /> },
                                                { label: 'Paste/Inject Attempts', count: selectedViolation.paste_count, icon: <Hash size={12} /> },
                                                { label: 'Tab/Window Switches', count: selectedViolation.tab_switch_count, icon: <Hash size={12} /> },
                                                { label: 'Fullscreen Exit Attempts', count: selectedViolation.fullscreen_exit_count, icon: <Hash size={12} /> },
                                                { label: 'Keyboard / DevTools (F12)', count: selectedViolation.devtools_count, icon: <ShieldAlert size={12} /> }
                                            ].map((v, i) => (
                                                <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1.5 rounded-lg ${v.count > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                                            {v.icon}
                                                        </div>
                                                        <span className={`text-xs font-bold ${v.count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                                            {v.label}
                                                        </span>
                                                    </div>
                                                    <span className={`text-sm font-black ${v.count > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                                        {v.count || 0}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => handleAction(selectedViolation.id, 'continue', selectedViolation.full_name || selectedViolation.username)}
                                    className="flex-1 h-12 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.15em] shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Play size={16} />
                                    Allow Continue
                                </button>
                                <button
                                    onClick={() => handleAction(selectedViolation.id, 'submit', selectedViolation.full_name || selectedViolation.username)}
                                    className="flex-1 h-12 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.15em] shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={16} />
                                    Finalize Submission
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Toast Container */}
            <div className="fixed bottom-8 right-8 z-[150] flex flex-col gap-3">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
                            }`}
                    >
                        <div className={`p-1.5 rounded-lg ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-800'}`}>
                            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                        </div>
                        <span className="font-bold text-sm tracking-tight">{toast.message}</span>
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scale-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scale-in {
                    animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}} />
        </SaaSLayout>
    );
};

export default AdminViolations;
