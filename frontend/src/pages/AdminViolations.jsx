import React, { useState, useEffect, useCallback } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import { getViolations, unlockTest } from '../services/api';
import {
    AlertTriangle,
    Play,
    CheckCircle,
    Clock,
    User,
    Hash,
    ShieldAlert,
    RefreshCw,
    Search
} from 'lucide-react';
import ToastContainer from '../components/Toast';

const AdminViolations = () => {
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

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
            fetchViolations();
        } catch (error) {
            console.error(`Failed to ${action} test:`, error);
            addToast(`Failed to ${action} test`, 'error');
        }
    };

    const filteredViolations = violations.filter(v =>
        v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.roll_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.username?.toLowerCase().includes(searchTerm.toLowerCase())
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
                                                <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => handleAction(v.id, 'continue', v.full_name || v.username)}
                                                        className="h-10 px-4 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                                                    >
                                                        <Play size={16} />
                                                        Continue
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(v.id, 'submit', v.full_name || v.username)}
                                                        className="h-10 px-4 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                                                    >
                                                        <CheckCircle size={16} />
                                                        Finish Test
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Custom Toast Container implementation within the page for now or using existing one if available */}
            <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3">
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
        </SaaSLayout>
    );
};

export default AdminViolations;
