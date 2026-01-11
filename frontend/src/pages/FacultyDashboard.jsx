import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    FileText,
    CheckCircle,
    Clock,
    ArrowRight,
    ClipboardList
} from 'lucide-react';

const FacultyDashboard = () => {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchQueue();
    }, []);

    const fetchQueue = async () => {
        try {
            const res = await api.get('/faculty/queue');
            setQueue(res.data);
        } catch (error) {
            console.error("Failed to load queue", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Faculty Workspace</h1>
                        <p className="text-slate-500 mt-1">Review and grade pending student submissions.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-bold text-slate-700">{queue.length} Tasks Pending</span>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                                <ClipboardList size={20} />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Evaluation Queue</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{queue.length}</p>
                    </div>
                    {/* Add more faculty-specific stats here if available */}
                </div>

                {/* Submissions Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800">Pending Evaluations</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 text-slate-500 font-bold text-[11px] uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Candidate</th>
                                    <th className="px-6 py-4">Course & Level</th>
                                    <th className="px-6 py-4">Submitted</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400">Loading your queue...</td></tr>
                                ) : queue.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                                                    <CheckCircle size={32} />
                                                </div>
                                                <p className="text-slate-400 font-medium">All caught up! No pending evaluations.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    queue.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                        {item.candidate_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <span className="font-bold text-slate-900">{item.candidate_name || 'Anonymous User'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-600 font-medium">{item.course_title}</span>
                                                <span className="mx-2 text-slate-300">•</span>
                                                <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded text-[10px]">L{item.level}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 font-medium">
                                                {new Date(item.submitted_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/faculty/evaluate/${item.id}`)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 hover:shadow-blue-600/20"
                                                >
                                                    Evaluate
                                                    <ArrowRight size={14} />
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
        </SaaSLayout>
    );
};

export default FacultyDashboard;
