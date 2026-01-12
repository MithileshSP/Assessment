import { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, AlertCircle, RefreshCw, BarChart3, Layers, Cpu } from 'lucide-react';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';

export default function AdminEvaluationTracker() {
    const [stats, setStats] = useState({
        queued: 0,
        evaluating: 0,
        recent: []
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = async () => {
        try {
            setRefreshing(true);
            const res = await api.get('/evaluate/queue-status');
            setStats(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch queue stats', err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <SaaSLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
            </SaaSLayout>
        );
    }

    return (
        <SaaSLayout title="Evaluation Monitor">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                {/* Header Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<Layers className="text-blue-600" size={24} />}
                        label="In Queue"
                        value={stats.queued}
                        color="blue"
                        description="Pending processing"
                    />
                    <StatCard
                        icon={<Cpu className="text-amber-600" size={24} />}
                        label="Active"
                        value={stats.evaluating}
                        color="amber"
                        description="Currently evaluating"
                    />
                    <StatCard
                        icon={<CheckCircle className="text-emerald-600" size={24} />}
                        label="Throughput"
                        value="High"
                        color="emerald"
                        description="System health: Optimal"
                    />
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center items-center gap-2">
                        <button
                            onClick={fetchStats}
                            disabled={refreshing}
                            className={`p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all ${refreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={20} />
                        </button>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Refresh</span>
                    </div>
                </div>

                {/* Queue Status Detail */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <Activity className="text-blue-600" />
                                Recent Completions
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                Real-time Updates
                            </span>
                        </div>

                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-50">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submission ID</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {stats.recent.length > 0 ? stats.recent.map((s) => (
                                            <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <span className="text-sm font-bold text-slate-600 font-mono tracking-tighter">
                                                        {String(s.id).slice(0, 8)}...
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${s.status === 'passed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                                        }`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-sm font-black text-slate-900">{s.final_score}%</span>
                                                </td>
                                                <td className="px-8 py-5 text-sm text-slate-400 font-medium">
                                                    {new Date(s.evaluated_at).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className="px-8 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <BarChart3 size={40} className="text-slate-200" />
                                                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No recent data available</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Insights Panel */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">System Status</h3>
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-8 shadow-2xl shadow-slate-900/20">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Queue Capacity</p>
                                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (stats.evaluating / 2) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-500 uppercase">
                                    <span>Idle</span>
                                    <span>Max Load</span>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center">
                                        <Activity size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Backend Worker</p>
                                        <p className="text-sm font-bold">Operational</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Polling Cycle</p>
                                        <p className="text-sm font-bold">5s Frequency</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-6">
                                <div className="flex items-center gap-3 mb-2 text-blue-400">
                                    <AlertCircle size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Admin Tip</span>
                                </div>
                                <p className="text-xs text-blue-100 leading-relaxed font-medium">
                                    The queuing system prevents backend crashes during high-concurrency exams by throttling browser instances.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
}

function StatCard({ icon, label, value, color, description }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600'
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${colorClasses[color]}`}>
                {icon}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-black text-slate-900 tracking-tight mb-2">{value}</p>
            <p className="text-[11px] text-slate-400 font-medium">{description}</p>
        </div>
    );
}
