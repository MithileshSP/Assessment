import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    Users,
    RefreshCw,
    CheckCircle,
    User,
    Mail,
    Activity,
    BookOpen,
    Clock,
    Shield,
    BarChart3
} from 'lucide-react';
import { formatIST } from '../utils/date';

export default function AdminAssignment() {
    const navigate = useNavigate();
    const [facultyLoad, setFacultyLoad] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalPending: 0, totalCompleted: 0 });

    useEffect(() => {
        loadFacultyData();
    }, []);

    const loadFacultyData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/faculty-load');
            setFacultyLoad(response.data);

            // Calculate global stats
            const pending = response.data.reduce((acc, f) => acc + f.pending, 0);
            const completed = response.data.reduce((acc, f) => acc + f.completed, 0);
            setStats({ totalPending: pending, totalCompleted: completed });
        } catch (error) {
            console.error('Failed to load faculty data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="max-w-full mx-auto py-8 px-4 sm:px-8 lg:px-12 font-sans antialiased text-slate-900">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 text-left">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
                            Faculty Management
                        </h1>
                        <p className="text-slate-500 font-medium text-base sm:text-lg">
                            Monitor evaluator workload, track submission progress, and manage department resources.
                        </p>
                    </div>
                    <button
                        onClick={loadFacultyData}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm hover:shadow active:scale-95"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh Portal
                    </button>
                </div>

                {/* Management Overview Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-12">
                    <div className="lg:col-span-2 xl:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-10 text-left shadow-sm">
                        <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
                            <Shield size={42} />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-2xl font-bold text-slate-900">Allocation Policy Overview</h3>
                            <p className="text-slate-500 text-base sm:text-lg leading-relaxed font-medium">
                                Submissions are distributed among faculty based on their specialized course assignments.
                                Evaluators are responsible for manual code review and requirements verification for all assigned candidates.
                            </p>
                            <div className="flex flex-wrap gap-6 pt-2">
                                <div className="flex items-center gap-2.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>
                                    Manual Verification Required
                                </div>
                                <div className="flex items-center gap-2.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                                    SLA: 24h Turnaround
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-10 text-white shadow-2xl shadow-slate-200 flex flex-col justify-between relative overflow-hidden text-left border border-slate-800">
                        <div className="absolute right-0 top-0 w-48 h-48 bg-indigo-500/10 rounded-full -mr-24 -mt-24" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 size={20} className="text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Live Metrics</span>
                            </div>
                            <h4 className="text-xl font-bold tracking-tight">System Workload</h4>
                        </div>
                        <div className="mt-8 grid grid-cols-2 gap-8 relative z-10">
                            <div>
                                <p className="text-4xl font-black tracking-tighter text-white">{stats.totalPending}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">In Queue</p>
                            </div>
                            <div>
                                <p className="text-4xl font-black tracking-tighter text-white">{stats.totalCompleted}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Verified</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Faculty Grid */}
                <div className="text-left">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                                <Users size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Evaluator Directory</h2>
                        </div>
                        <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                            <Activity size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Real-time Performance Monitoring</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-80 bg-white rounded-3xl border border-slate-100 animate-pulse shadow-sm" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                            {facultyLoad.length === 0 ? (
                                <div className="col-span-full py-32 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-6 text-slate-400">
                                    <Users size={64} className="opacity-10" />
                                    <div className="text-center">
                                        <p className="font-bold text-slate-600 text-xl mb-1">No Evaluators Provisioned</p>
                                        <p className="text-slate-400 font-medium">Add faculty members in User Management to see them here.</p>
                                    </div>
                                </div>
                            ) : (
                                facultyLoad.map((faculty) => (
                                    <div key={faculty.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-indigo-400/30 transition-all duration-500 overflow-hidden flex flex-col group relative">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/0 to-transparent group-hover:via-indigo-500 transition-all duration-500" />
                                        <div className="p-8 flex-1">
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform duration-500 border border-indigo-100">
                                                        {faculty.full_name?.charAt(0) || faculty.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-900 text-xl leading-tight truncate group-hover:text-indigo-600 transition-colors">
                                                            {faculty.full_name || faculty.username}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mt-1.5 uppercase tracking-wider">
                                                            <Mail size={12} className="shrink-0" />
                                                            <span className="truncate">{faculty.email || 'pending-auth'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-5 mb-8">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                                        <BookOpen size={12} />
                                                        Specializations
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {faculty.courses?.length > 0 ? (
                                                            faculty.courses.map((c, i) => (
                                                                <span key={i} className="px-3 py-1 bg-indigo-50/50 border border-indigo-100/50 rounded-lg text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest">
                                                                    {c}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 italic uppercase bg-slate-50 px-3 py-1 rounded-lg">General Educator</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="pt-2 border-t border-slate-50">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">
                                                        <Clock size={12} />
                                                        Last Presence
                                                    </div>
                                                    <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest">
                                                        {faculty.last_login ? formatIST(faculty.last_login) : 'Record Unavailable'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center group-hover:bg-amber-50/30 group-hover:border-amber-100 transition-colors">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Queue</p>
                                                    <p className="text-3xl font-black text-amber-600 leading-none tracking-tighter">{faculty.pending}</p>
                                                </div>
                                                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center group-hover:bg-emerald-50/30 group-hover:border-emerald-100 transition-colors">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Done</p>
                                                    <p className="text-3xl font-black text-emerald-600 leading-none tracking-tighter">{faculty.completed}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-8 py-5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between group-hover:bg-indigo-50/30 transition-colors">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-2 h-2 rounded-full animate-pulse ${faculty.pending > 5 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${faculty.pending > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {faculty.pending > 5 ? 'Overloaded' : 'Operational'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">ID {faculty.id}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </SaaSLayout>
    );
}
