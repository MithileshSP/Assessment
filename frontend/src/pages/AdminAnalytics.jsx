import React, { useState, useEffect } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api, { BASE_URL } from '../services/api';
import {
    Activity,
    Users,
    CheckCircle,
    XCircle,
    TrendingUp,
    Download,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Play,
    Calendar,
    MousePointer2,
    BarChart3
} from 'lucide-react';

const AdminAnalytics = () => {
    const [overview, setOverview] = useState(null);
    const [history, setHistory] = useState([]);
    const [clearedStudents, setClearedStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('all');

    useEffect(() => {
        fetchAnalyticsData();
    }, []);

    const fetchAnalyticsData = async () => {
        try {
            setLoading(true);
            const [overviewRes, historyRes, clearedRes] = await Promise.all([
                api.get('/admin/analytics/overview'),
                api.get('/admin/analytics/history'),
                api.get('/admin/analytics/cleared-students')
            ]);
            setOverview(overviewRes.data);
            setHistory(historyRes.data);
            setClearedStudents(clearedRes.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (courseId) => {
        window.open(`${BASE_URL}/admin/analytics/export/${courseId}`, '_blank');
    };

    const filteredStudents = clearedStudents.filter(s => {
        const matchesSearch =
            s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.roll_no?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCourse = selectedCourse === 'all' || s.course_title === selectedCourse;
        return matchesSearch && matchesCourse;
    });

    if (loading) {
        return (
            <SaaSLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Processing Analytics...</p>
                    </div>
                </div>
            </SaaSLayout>
        );
    }

    // Calculate max height for history bars
    const maxAttempts = Math.max(...history.map(h => h.attempts), 1);

    return (
        <SaaSLayout>
            <div className="space-y-10 animate-in fade-in duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <BarChart3 className="text-indigo-600" size={24} />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Performance Intelligence</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
                        <p className="text-slate-500 font-medium mt-1">Deep dive into student engagement and completion metrics.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchAnalyticsData}
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all hover:bg-slate-50 shadow-sm"
                        >
                            <Calendar size={20} />
                        </button>
                        <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 text-sm">
                            <Download size={18} /> Master Report
                        </button>
                    </div>
                </div>

                {/* Top Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            label: 'Total Attempts',
                            value: overview?.overall?.total_attempts || 0,
                            icon: <Activity />,
                            color: 'indigo',
                            trend: '+12%',
                            isUp: true
                        },
                        {
                            label: 'Students Cleared',
                            value: overview?.overall?.cleared_counts || 0,
                            icon: <CheckCircle />,
                            color: 'emerald',
                            trend: '+8%',
                            isUp: true
                        },
                        {
                            label: 'Failed Attempts',
                            value: overview?.overall?.failed_counts || 0,
                            icon: <XCircle />,
                            color: 'rose',
                            trend: '-3%',
                            isUp: false
                        },
                        {
                            label: 'Success Rate',
                            value: `${Math.round((overview?.overall?.cleared_counts / (overview?.overall?.total_attempts || 1)) * 100)}%`,
                            icon: <TrendingUp />,
                            color: 'amber',
                            trend: '+2.4%',
                            isUp: true
                        }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group">
                            <div className="flex items-center justify-between mb-6">
                                <div className={`p-4 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                                    {stat.icon}
                                </div>
                                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${stat.isUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                    {stat.isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                    {stat.trend}
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
                        </div>
                    ))}
                </div>

                {/* Main Visualizations Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Activity Graph Card */}
                    <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Attempt Activity</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Last 30 Days Breakdown</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" /> Total Attempts
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 ml-4">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Cleared
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 flex items-end justify-between items-baseline gap-1 pt-10 min-h-[250px] relative">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between py-10 pointer-events-none opacity-[0.03]">
                                {[...Array(5)].map((_, i) => <div key={i} className="w-full border-t border-slate-900" />)}
                            </div>

                            {history.length > 0 ? history.map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative z-10">
                                    <div className="w-full flex flex-col items-center justify-end gap-1 h-full min-h-[200px]">
                                        {/* Total Bar */}
                                        <div
                                            className="w-[60%] bg-slate-50 border border-slate-100 rounded-t-md group-hover:bg-indigo-100 group-hover:border-indigo-200 transition-all relative overflow-hidden"
                                            style={{ height: `${(h.attempts / maxAttempts) * 100}%` }}
                                        >
                                            {/* Cleared Section (Nested) */}
                                            <div
                                                className="absolute bottom-0 left-0 w-full bg-indigo-500 rounded-t-sm group-hover:bg-indigo-600 transition-colors"
                                                style={{ height: `${(h.cleared / (h.attempts || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    {/* Tooltip on hover */}
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                        {new Date(h.date).toLocaleDateString()}: {h.attempts} attempts
                                    </div>
                                </div>
                            )) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                                    Insufficient Data Points
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Course Distribution Card */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Course Distribution</h3>
                        <div className="space-y-6">
                            {overview?.courses?.map((course, i) => (
                                <div key={course.course_id} className="space-y-2 group">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{course.course_title}</span>
                                        <span className="font-black text-slate-900">{course.cleared}/{course.attempts}</span>
                                    </div>
                                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                        <div
                                            className={`h-full transition-all duration-1000 bg-gradient-to-r ${i % 2 === 0 ? 'from-indigo-500 to-blue-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'from-emerald-500 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}
                                            style={{ width: `${(course.cleared / (course.attempts || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{Math.round((course.cleared / (course.attempts || 1)) * 100)}% Pass Rate</span>
                                        <button
                                            onClick={() => handleExport(course.course_id)}
                                            className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                                        >
                                            Download CSV <Download size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Cleared Students List */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Cleared Students Repository</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Verified Performance History</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name, roll, email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300"
                                />
                            </div>
                            <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-600 transition-all text-slate-600 appearance-none pr-10 relative"
                            >
                                <option value="all">All Courses</option>
                                {[...new Set(clearedStudents.map(s => s.course_title))].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll Number</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Course & Level</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredStudents.map((student, idx) => (
                                    <tr key={`${student.user_id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black border border-indigo-100">
                                                    {student.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.full_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">{student.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <span className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                                                {student.roll_no || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-800 text-sm">{student.course_title}</span>
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Lvl {student.level}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 font-black text-slate-900">
                                            {student.final_score}
                                        </td>
                                        <td className="px-10 py-6 text-xs text-slate-400 font-medium">
                                            {new Date(student.submitted_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                <CheckCircle size={10} /> Cleared
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Users size={40} className="text-slate-200" />
                                                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No matches found in repository</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default AdminAnalytics;
