import React, { useState, useEffect } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    Calendar,
    Clock,
    Plus,
    Trash2,
    RefreshCw,
    Save,
    Zap
} from 'lucide-react';
import ToastContainer from '../components/Toast';

const AdminSchedule = () => {
    const [submitting, setSubmitting] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [schedules, setSchedules] = useState([
        { start_time: '09:00:00', end_time: '12:00:00', is_active: true },
        { start_time: '14:00:00', end_time: '17:00:00', is_active: true }
    ]);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const fetchSchedules = async () => {
        try {
            const res = await api.get('/attendance/schedule');
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                setSchedules(res.data);
            }
        } catch (e) {
            console.error("Failed to fetch schedules", e);
            addToast("Failed to load schedules from server", "error");
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const handleAddSession = () => {
        setSchedules(prev => [...prev, { start_time: '09:00:00', end_time: '17:00:00', is_active: true }]);
    };

    const handleRemoveSession = (index) => {
        setSchedules(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateSession = (index, field, value) => {
        const newSchedules = [...schedules];
        newSchedules[index] = { ...newSchedules[index], [field]: value };
        setSchedules(newSchedules);
    };

    const handleSaveSchedules = async () => {
        try {
            setSubmitting(true);
            await api.post('/attendance/schedule', { schedules });
            addToast("Daily schedules updated successfully!", "success");
        } catch (e) {
            addToast("Failed to update schedules", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SaaSLayout>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <div className="min-h-screen bg-slate-50/50 -m-8 p-8 font-sans antialiased text-slate-900">
                <div className="max-w-5xl mx-auto mb-10 text-left">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Clock size={18} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                            Automated Gatekeeping
                        </span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
                        Recurring Daily Sessions
                    </h1>
                    <p className="text-slate-500 font-medium text-base">
                        Define multiple access windows that repeat every day for all assessments.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-indigo-600" size={20} />
                                <h3 className="text-lg font-bold text-slate-800">Master Schedule</h3>
                            </div>
                            <button
                                onClick={handleAddSession}
                                className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border border-indigo-100 flex items-center gap-2"
                            >
                                <Plus size={14} /> Add Session
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {schedules.length === 0 ? (
                                <div className="py-12 text-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No sessions defined</p>
                                    <button onClick={handleAddSession} className="mt-4 text-indigo-600 font-black text-xs uppercase underline">Define first session</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {schedules.map((session, idx) => (
                                        <div key={idx} className="group flex flex-col md:flex-row items-end gap-4 p-6 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all">
                                            <div className="flex-1 space-y-2 w-full">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                                                <input
                                                    type="time"
                                                    value={session.start_time}
                                                    onChange={(e) => handleUpdateSession(idx, 'start_time', e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg font-bold focus:border-indigo-600 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2 w-full">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</label>
                                                <input
                                                    type="time"
                                                    value={session.end_time}
                                                    onChange={(e) => handleUpdateSession(idx, 'end_time', e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg font-bold focus:border-indigo-600 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="flex items-center bg-white px-4 py-3 border border-slate-200 rounded-lg h-[50px]">
                                                <input
                                                    type="checkbox"
                                                    id={`active-${idx}`}
                                                    checked={session.is_active}
                                                    onChange={(e) => handleUpdateSession(idx, 'is_active', e.target.checked)}
                                                    className="w-4 h-4 text-indigo-600 rounded"
                                                />
                                                <label htmlFor={`active-${idx}`} className="ml-2 text-xs font-bold text-slate-600 cursor-pointer">Active</label>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveSession(idx)}
                                                className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                                <div className="flex items-center gap-3 text-slate-400">
                                    <Zap size={16} />
                                    <p className="text-xs font-medium">Automatic gating synchronizes portal access with these windows.</p>
                                </div>
                                <button
                                    onClick={handleSaveSchedules}
                                    disabled={submitting}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg flex items-center gap-3 disabled:opacity-50"
                                >
                                    {submitting ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                    Save All Sessions
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-indigo-900 p-8 rounded-xl text-white relative overflow-hidden group text-left">
                            <div className="relative z-10">
                                <h4 className="text-lg font-black mb-2">Autonomous Operations</h4>
                                <p className="text-indigo-200 text-sm font-medium leading-relaxed">
                                    The system automatically monitors server time. When a session starts, all unblocked students gain instant entry without manual intervention.
                                </p>
                            </div>
                            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700"></div>
                        </div>
                        <div className="bg-white p-8 rounded-xl border border-slate-200 text-left">
                            <h4 className="text-lg font-black text-slate-900 mb-2">Quick Configuration</h4>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                You can define separate windows for morning and afternoon rounds. Overlapping windows will be treated as a single continuous session.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default AdminSchedule;
