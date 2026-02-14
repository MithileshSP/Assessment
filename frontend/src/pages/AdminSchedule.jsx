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
import { formatIST } from '../utils/date';


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
            <div className="max-w-5xl mx-auto py-8 px-4 font-sans antialiased text-slate-900">
                <div className="mb-10 text-left">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
                        Session Scheduling
                    </h1>
                    <p className="text-slate-500 font-medium text-base">
                        Manage daily access windows for assessment sessions.
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white gap-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-indigo-600" size={20} />
                            <h3 className="text-lg font-semibold text-slate-800">Master Schedule</h3>
                        </div>
                        <button
                            onClick={handleAddSession}
                            className="w-full sm:w-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border border-indigo-100 flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Add Session
                        </button>
                    </div>

                    <div className="p-4 sm:p-8 space-y-6">
                        {schedules.length === 0 ? (
                            <div className="py-12 text-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No sessions defined</p>
                                <button onClick={handleAddSession} className="mt-4 text-indigo-600 font-black text-xs uppercase underline">Define first session</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {schedules.map((session, idx) => (
                                    <div key={idx} className="group relative p-4 sm:p-6 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all">
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                            <div className="md:col-span-4 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Time</label>
                                                    <span className="text-[10px] font-semibold text-indigo-600 uppercase">{formatIST(session.start_time)}</span>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={session.start_time}
                                                    onChange={(e) => handleUpdateSession(idx, 'start_time', e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                                />
                                            </div>

                                            <div className="md:col-span-4 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Time</label>
                                                    <span className="text-[10px] font-semibold text-indigo-600 uppercase">{formatIST(session.end_time)}</span>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={session.end_time}
                                                    onChange={(e) => handleUpdateSession(idx, 'end_time', e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                                />
                                            </div>

                                            <div className="md:col-span-3 flex items-center bg-white px-4 py-2.5 border border-slate-200 rounded-lg h-[46px]">
                                                <input
                                                    type="checkbox"
                                                    id={`active-${idx}`}
                                                    checked={session.is_active}
                                                    onChange={(e) => handleUpdateSession(idx, 'is_active', e.target.checked)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                />
                                                <label htmlFor={`active-${idx}`} className="ml-3 text-sm font-medium text-slate-700 cursor-pointer select-none">Active Session</label>
                                            </div>

                                            <div className="md:col-span-1 flex justify-end">
                                                <button
                                                    onClick={() => handleRemoveSession(idx)}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Remove Session"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-6 flex justify-end border-t border-slate-100">
                            <button
                                onClick={handleSaveSchedules}
                                disabled={submitting}
                                className="w-full sm:w-auto px-10 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm transition-all hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default AdminSchedule;
