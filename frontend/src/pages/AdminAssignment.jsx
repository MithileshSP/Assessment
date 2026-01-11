import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    Users,
    RefreshCw,
    CheckCircle,
    BarChart2,
    User,
    Mail,
    Activity,
    Zap
} from 'lucide-react';

export default function AdminAssignment() {
    const navigate = useNavigate();
    const [facultyLoad, setFacultyLoad] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        loadFacultyData();
    }, []);

    const loadFacultyData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/faculty-load');
            setFacultyLoad(response.data);
        } catch (error) {
            console.error('Failed to load faculty data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoAssign = async () => {
        if (!window.confirm('This will distribute all pending unassigned submissions to faculty members in a round-robin fashion. Continue?')) return;

        try {
            setAssigning(true);
            const response = await api.post('/admin/assign/auto');
            setLastResult(response.data);
            await loadFacultyData();
            alert(`Assignment Complete! Assigned ${response.data.assignedCount} submissions.`);
        } catch (error) {
            console.error('Auto-assign failed:', error);
            alert('Failed to auto-assign: ' + (error.response?.data?.error || error.message));
        } finally {
            setAssigning(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight text-left">Faculty Allocation</h1>
                        <p className="text-slate-500 mt-1 text-left">Manage grading workload and automation engine.</p>
                    </div>
                </div>

                {/* Auto-Assignment Engine Card */}
                <div className="bg-[#1e293b] rounded-2xl p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="max-w-xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4">
                                <Zap size={12} fill="currentColor" />
                                Smart Allocation
                            </div>
                            <h2 className="text-2xl font-bold mb-3">Round-Robin Assignment Engine</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Automatically balance the grading workload across your active faculty team.
                                The engine identifies unassigned submissions and distributes them sequentially.
                            </p>
                        </div>
                        <button
                            onClick={handleAutoAssign}
                            disabled={assigning || facultyLoad.length === 0}
                            className={`whitespace-nowrap px-8 py-4 rounded-xl font-bold shadow-2xl transition-all flex items-center gap-3
                                ${assigning || facultyLoad.length === 0
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-blue-600/20'}`}
                        >
                            <RefreshCw className={assigning ? 'animate-spin' : ''} size={20} />
                            {assigning ? 'Executing...' : 'Run Auto-Assign'}
                        </button>
                    </div>

                    {lastResult && (
                        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-fade-in relative z-10">
                            <CheckCircle className="text-emerald-400" size={20} />
                            <p className="text-sm text-emerald-100 italic">
                                Last run assigned <span className="font-bold text-white">{lastResult.assignedCount}</span> submissions successfully.
                            </p>
                        </div>
                    )}
                </div>

                {/* Faculty Workload Grid */}
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <BarChart2 className="text-blue-600" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Department Workload</h2>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-44 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-bold uppercase tracking-widest">
                            {facultyLoad.length === 0 ? (
                                <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-300 flex flex-col items-center gap-3 text-slate-400 font-normal normal-case tracking-normal">
                                    <Users size={48} className="opacity-20" />
                                    <p>No faculty members found in the system.</p>
                                </div>
                            ) : (
                                facultyLoad.map((faculty) => (
                                    <div key={faculty.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-3 text-left">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    {faculty.full_name?.charAt(0) || faculty.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors normal-case tracking-normal">{faculty.full_name || faculty.username}</p>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                        <Mail size={12} />
                                                        {faculty.email || 'No Email'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-2 py-1 bg-slate-50 rounded text-[9px] font-bold text-slate-400">ID: {faculty.id}</div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 mb-6 text-center tracking-normal normal-case">
                                            <div className="p-3 bg-amber-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pending</p>
                                                <p className="text-xl font-bold text-amber-700">{faculty.pending}</p>
                                            </div>
                                            <div className="p-3 bg-emerald-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Done</p>
                                                <p className="text-xl font-bold text-emerald-700">{faculty.completed}</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                                                <p className="text-xl font-bold text-slate-700">{faculty.total}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 uppercase tracking-widest">
                                            <div className="flex justify-between text-[10px] font-bold mb-1">
                                                <span className="text-slate-400">Load Intensity</span>
                                                <span className={faculty.pending > 5 ? 'text-rose-500' : 'text-blue-500'}>
                                                    {faculty.pending > 5 ? 'Overloaded' : 'Optimal'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${faculty.pending > 5 ? 'bg-rose-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, (faculty.pending / 10) * 100)}%` }}
                                                />
                                            </div>
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
