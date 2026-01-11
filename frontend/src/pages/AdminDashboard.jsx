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
  Clock
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
  ];

  return (
    <SaaSLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Overview</h1>
          <p className="text-slate-500 mt-1">Monitor system health and pending administrative actions.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {widgets.map((widget, idx) => (
            <div
              key={idx}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => widget.action && navigate(widget.action)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-${widget.color}-50 text-${widget.color}-600 group-hover:scale-110 transition-transform duration-200`}>
                  {widget.icon}
                </div>
                {widget.action && <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />}
              </div>
              <p className="text-sm font-medium text-slate-500">{widget.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? '...' : widget.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Submissions */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Recent Submissions</h3>
              <button
                onClick={() => navigate('/admin/results')}
                className="text-blue-600 hover:text-blue-700 font-bold transition-colors"
                style={{ fontSize: 13 }}
              >
                View All Results
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentSubmissions.map((sub) => (
                <div key={sub.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                      {sub.candidateName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{sub.candidateName}</p>
                      <p className="text-slate-400 text-xs">Level {sub.level} • {new Date(sub.submitted_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider border ${sub.status === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        sub.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                      {sub.status}
                    </span>
                    <button
                      onClick={() => navigate(`/admin/submission/${sub.id}`)}
                      className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {recentSubmissions.length === 0 && !loading && (
                <div className="p-12 text-center text-slate-400">
                  No submissions yet.
                </div>
              )}
            </div>
          </div>

          {/* Pending Tasks */}
          <div className="space-y-6">
            <div className="bg-[#1e293b] rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-400" />
                Pending Tasks
              </h3>
              <div className="space-y-4">
                <div
                  className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                  onClick={() => navigate('/admin/attendance')}
                >
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Attendance</p>
                  <p className="font-bold text-xl">{stats.pendingAttendance}</p>
                  <p className="text-xs text-slate-500 mt-1">Students waiting to start tests</p>
                </div>
                <div
                  className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                  onClick={() => navigate('/admin/assignment')}
                >
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Evaluations</p>
                  <p className="font-bold text-xl">{stats.pendingEvaluations}</p>
                  <p className="text-xs text-slate-500 mt-1">Unassigned or pending faculty review</p>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-500" />
              <h3 className="font-bold text-lg mb-2 relative z-10">Pro-Tip 💡</h3>
              <p className="text-blue-100 text-sm leading-relaxed relative z-10">
                Use the **Faculty Allocation** tool to automatically balance grading workload using the Round-Robin algorithm.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SaaSLayout>
  );
};

export default AdminDashboard;
