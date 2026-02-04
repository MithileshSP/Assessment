import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
  Users,
  BookOpen,
  FileText,
  Calendar,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  TrendingUp,
  Database
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalSubmissions: 0,
    pendingAttendance: 0,
    pendingEvaluations: 0
  });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, submissionsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/submissions')
      ]);
      setStats(statsRes.data);
      setRecentSubmissions(submissionsRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const widgets = [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={24} />, color: 'blue' },
    { label: 'Courses', value: stats.totalCourses, icon: <BookOpen size={24} />, color: 'indigo' },
    { label: 'Submissions', value: stats.totalSubmissions, icon: <FileText size={24} />, color: 'emerald' },
    { label: 'Attendance Requests', value: stats.pendingAttendance, icon: <Calendar size={24} />, color: 'orange', action: '/admin/attendance' },
    { label: 'Bulk Level Unlock', value: 'Tools', icon: <Database size={24} />, color: 'purple', action: '/admin/bulk-completion' },
  ];

  return (
    <SaaSLayout>
      <div className="space-y-10">
        {/* Welcome Header */}
        <div className="animate-fade-in-up flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Platform Overview</h1>
            <p className="text-slate-500 mt-2 text-lg">Monitor system health and pending administrative actions.</p>
          </div>
          <button
            onClick={() => navigate('/admin/analytics')}
            className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-600/20 active:scale-95 group"
          >
            Intelligence Alpha
            <TrendingUp size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
          {widgets.map((widget, idx) => (
            <div
              key={idx}
              className={`bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 cursor-pointer group animate-fade-in-up delay-${idx + 1}00 hover:-translate-y-2`}
              onClick={() => widget.action && navigate(widget.action)}
            >
              <div className="flex items-center justify-between mb-6">
                <div className={`p-4 rounded-2xl bg-${widget.color}-50 text-${widget.color}-600 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm`}>
                  {widget.icon}
                </div>
                {widget.action && (
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all">
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">{widget.label}</p>
                <div className="flex items-end gap-3 mt-2">
                  <p className="text-4xl font-black text-slate-900 leading-none">
                    {loading ? '...' : widget.value}
                  </p>
                  {!loading && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-${widget.color}-50 text-${widget.color}-600 border border-${widget.color}-100/50`}>
                      <Clock size={10} /> +2.4%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-10">
          {/* Recent Submissions */}
          <div className="lg:col-span-2 2xl:col-span-3 3xl:col-span-4 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden text-sm animate-fade-in-up delay-500">
            <div className="px-8 py-7 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-black text-slate-800">Recent Submissions</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time Activity</p>
              </div>
              <button
                onClick={() => navigate('/admin/results')}
                className="px-5 py-2.5 bg-slate-50 hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-black rounded-xl transition-all border border-slate-100 uppercase text-[10px] tracking-widest"
              >
                View All Results
              </button>
            </div>
            <div className="divide-y divide-slate-50 px-2">
              {recentSubmissions.map((sub, idx) => (
                <div key={sub.id} className="px-6 py-5 flex items-center justify-between hover:bg-slate-50/80 hover:rounded-3xl transition-all duration-300 group mx-2 my-1">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-black text-lg group-hover:scale-110 group-hover:bg-white group-hover:shadow-lg transition-all">
                      {sub.candidateName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-base">{sub.candidateName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-slate-400 font-bold">Level {sub.level}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-slate-400">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest border shadow-sm ${sub.status === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        sub.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                        {sub.status}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/admin/submission/${sub.id}`)}
                      className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center border border-slate-100 hover:scale-110 active:scale-95"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              ))}
              {recentSubmissions.length === 0 && !loading && (
                <div className="p-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={40} className="text-slate-200" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No submissions yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Pending Tasks */}
          <div className="space-y-8 animate-fade-in-up delay-700">
            <div className="bg-[#0f172a] rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />

              <h3 className="font-black text-xl mb-8 flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/20">
                  <AlertCircle size={22} className="animate-pulse" />
                </div>
                Pending Tasks
              </h3>

              <div className="space-y-5 relative z-10">
                <div
                  className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 hover:border-white/20 transition-all cursor-pointer group/item flex items-center justify-between"
                  onClick={() => navigate('/admin/attendance')}
                >
                  <div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Attendance</p>
                    <p className="font-black text-3xl group-hover/item:text-blue-400 transition-colors">{stats.pendingAttendance}</p>
                    <p className="text-xs text-slate-500 mt-1 font-bold">Waiting to start</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-700/50 flex items-center justify-center text-slate-400 group-hover/item:bg-blue-500/20 group-hover/item:text-blue-400 transition-all">
                    <Clock size={24} />
                  </div>
                </div>

                <div
                  className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 hover:border-white/20 transition-all cursor-pointer group/item flex items-center justify-between"
                  onClick={() => navigate('/admin/assignment')}
                >
                  <div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Evaluations</p>
                    <p className="font-black text-3xl group-hover/item:text-emerald-400 transition-colors">{stats.pendingEvaluations}</p>
                    <p className="text-xs text-slate-500 mt-1 font-bold">Needs Review</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-700/50 flex items-center justify-center text-slate-400 group-hover/item:bg-emerald-500/20 group-hover/item:text-emerald-400 transition-all">
                    <CheckCircle size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-600/30 relative overflow-hidden group border border-blue-500/20">
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700 blur-2xl" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 border border-white/10">
                  <CheckCircle size={24} className="text-blue-100" />
                </div>
                <h3 className="font-black text-xl mb-3 tracking-tight">System Tip 💡</h3>
                <p className="text-blue-100 text-sm leading-relaxed font-bold">
                  Use the **Faculty Allocation** tool to automatically balance grading workload using the Round-Robin algorithm.
                </p>
                <button className="mt-6 text-xs font-black uppercase tracking-widest flex items-center gap-2 text-white hover:translate-x-2 transition-transform">
                  Learn More <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SaaSLayout>
  );
};

export default AdminDashboard;
