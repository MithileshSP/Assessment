import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    History,
    CheckCircle,
    ArrowRight,
    Trophy
} from 'lucide-react';

const FacultyHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/faculty/history');
            setHistory(res.data);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="space-y-8 text-left">
                {/* Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Evaluation History</h1>
                        <p className="text-slate-500 mt-1">Review your previously graded assessment sequences.</p>
                    </div>
                </div>

                {/* Submissions Table */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden text-sm">
                    <div className="px-8 py-6 border-b border-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <History size={18} className="text-blue-500" />
                            Completed Evaluations
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Candidate</th>
                                    <th className="px-8 py-5">Course & Level</th>
                                    <th className="px-8 py-5 text-center">Score</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="4" className="px-8 py-12 text-center text-slate-400">Syncing history records...</td></tr>
                                ) : history.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                                    <Trophy size={32} />
                                                </div>
                                                <p className="text-slate-400 font-medium">No evaluation history found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-xs uppercase">
                                                        {item.candidate_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <span className="font-bold text-slate-900">{item.candidate_name || 'Anonymous User'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-700 font-bold">{item.course_title}</span>
                                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">Level {item.level} • {item.challenge_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-sm">
                                                    {item.manual_score}%
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => navigate(`/faculty/evaluate/${item.id}`)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                >
                                                    View Grade
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

export default FacultyHistory;
