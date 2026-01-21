import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getUserSubmissions } from '../services/api';
import {
    Trophy,
    CheckCircle,
    XCircle,
    Clock,
    ExternalLink,
    Search,
    Filter,
    ArrowRight
} from 'lucide-react';

const StudentResults = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    const userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?.id;

    useEffect(() => {
        if (userId) {
            fetchResults();
        }
    }, [userId]);

    const fetchResults = async () => {
        try {
            setLoading(true);
            const res = await getUserSubmissions(userId);
            setSubmissions(res.data);
        } catch (error) {
            console.error("Failed to fetch results", error);
        } finally {
            setLoading(false);
        }
    };

    const filtered = submissions.filter(s =>
        (s.courseId || '').toLowerCase().includes(search.toLowerCase()) ||
        `Level ${s.level}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SaaSLayout>
            <div className="space-y-8 text-left">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Performance Ledger</h1>
                        <p className="text-slate-500 mt-1 font-medium">History of your assessment sequences and technical evaluations.</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-2 border border-slate-100 rounded-2xl shadow-sm w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by course..."
                                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Assessment Sequence</th>
                                    <th className="px-8 py-5">Result Status</th>
                                    <th className="px-8 py-5">Faculty Feedback</th>
                                    <th className="px-8 py-5">Date</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                                    <Trophy size={32} />
                                                </div>
                                                <p className="text-slate-400 font-medium">No assessment history found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((sub) => (
                                        <React.Fragment key={sub.id}>
                                            <tr className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                                                            L{sub.level}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 capitalize">{sub.courseId?.replace('-', ' ')}</p>
                                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Module Access</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    {sub.status === 'passed' ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                            <CheckCircle size={12} />
                                                            Cleared
                                                        </div>
                                                    ) : sub.status === 'failed' ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                            <XCircle size={12} />
                                                            Re-attempt Required
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                            <Clock size={12} />
                                                            In Evaluation
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <p className="text-sm text-slate-600 font-medium line-clamp-1 max-w-xs">
                                                        {sub.manual_feedback || "Awaiting faculty comments..."}
                                                    </p>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="text-slate-500 font-medium text-sm">
                                                        {new Date(sub.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button
                                                        onClick={() => navigate(`/level-results/${sub.courseId}/${sub.level}`)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all"
                                                    >
                                                        Details
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        </React.Fragment>
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

export default StudentResults;
