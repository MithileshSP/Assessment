import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
  Users,
  BookOpen,
  FileText,
  Calendar,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Plus,
  UserPlus,
  Activity,
  ChevronDown
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
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    setUserName(localStorage.getItem('fullName') || 'Administrator');
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, submissionsRes, historyRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/submissions'),
        api.get('/admin/analytics/history')
      ]);
      setStats(statsRes.data);
      setRecentSubmissions(submissionsRes.data.slice(0, 8));
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Advanced Heatmap Logic: Group by Month for the selected year
  const monthsData = useMemo(() => {
    const data = [];
    const historyMap = {};

    history.forEach(item => {
      const d = new Date(item.date);
      if (d.getFullYear() === selectedYear) {
        historyMap[d.toDateString()] = item.attempts;
      }
    });

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    for (let m = 0; m < 12; m++) {
      const monthDays = [];
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(selectedYear, m, d);
        monthDays.push({
          date,
          count: historyMap[date.toDateString()] || 0
        });
      }
      data.push({ name: monthNames[m], days: monthDays });
    }
    return data;
  }, [history, selectedYear]);

  const widgets = [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={20} />, color: 'blue', action: '/admin/users' },
    { label: 'Courses', value: stats.totalCourses, icon: <BookOpen size={20} />, color: 'blue', action: '/admin/courses' },
    { label: 'Submissions', value: stats.totalSubmissions, icon: <FileText size={20} />, color: 'blue', action: '/admin/results' },
    { label: 'Attendance Requests', value: stats.pendingAttendance, icon: <Calendar size={20} />, color: 'amber', action: '/admin/attendance' },
  ];

  const quickActions = [
    { label: 'New Course', icon: <Plus size={16} />, path: '/admin/courses', color: 'bg-blue-600' },
    { label: 'Add User', icon: <UserPlus size={16} />, path: '/admin/users', color: 'bg-slate-800' },
    { label: 'System Logs', icon: <Activity size={16} />, path: '/admin/violations', color: 'bg-slate-800' },
  ];

  return (
    <SaaSLayout>
      <div className="space-y-8 pb-10">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">System Online</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {greeting}, <span className="text-blue-600">{userName.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Enterprise assessment overview and activity tracking.</p>
          </div>

          <div className="flex items-center gap-3">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => navigate(action.path)}
                className={`h-9 px-4 ${action.color} text-white rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all shadow-sm active:scale-95`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* System Pulse - Advanced Heatmap Section */}
        <div className="bg-white rounded-md border border-slate-200 p-6 shadow-sm animate-fade-in-up delay-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                <Activity size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Task Submission Activity</h3>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 hover:bg-white transition-all cursor-pointer">
                {selectedYear}
                <ChevronDown size={12} />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>Less</span>
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-slate-100" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-100" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-300" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-500" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-700" />
                  </div>
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-8 overflow-x-auto pb-4 custom-scrollbar">
            {loading ? (
              <div className="w-full h-32 bg-slate-50 animate-pulse rounded-md" />
            ) : (
              monthsData.map((month, idx) => (
                <div key={idx} className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="grid grid-flow-col grid-rows-7 gap-1 mb-3"
                  >
                    {month.days.map((day, dIdx) => {
                      const intensity = day.count === 0 ? 'bg-slate-100' :
                        day.count < 5 ? 'bg-blue-100' :
                          day.count < 15 ? 'bg-blue-300' :
                            day.count < 30 ? 'bg-blue-500' : 'bg-blue-700';
                      return (
                        <div
                          key={dIdx}
                          className={`w-3 h-3 rounded-[2px] ${intensity} transition-all hover:ring-2 hover:ring-blue-200 cursor-help relative group/day`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] rounded opacity-0 group-hover/day:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none font-bold">
                            {day.count} Submissions • {day.date.toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 tracking-tighter">{month.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up delay-200">
          {widgets.map((widget, idx) => (
            <div
              key={idx}
              className="bg-white p-5 rounded-md border border-slate-200 shadow-sm hover:border-blue-200 transition-all cursor-pointer group"
              onClick={() => navigate(widget.action)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-md bg-${widget.color}-50 text-${widget.color}-600 group-hover:scale-105 transition-transform`}>
                  {widget.icon}
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-all">
                  <ArrowRight size={12} />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{widget.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? '...' : widget.value}
                </p>
                {!loading && (
                  <span className="text-[9px] font-bold text-emerald-600">+12%</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up delay-300">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">System Feed</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Most Recent Activity</p>
              </div>
              <button
                onClick={() => navigate('/admin/results')}
                className="text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
              >
                View Register
              </button>
            </div>
            <div className="divide-y divide-slate-50 px-2 lg:max-h-[400px] overflow-y-auto custom-scrollbar">
              {recentSubmissions.map((sub) => {
                const subDate = sub.submitted_at ? new Date(sub.submitted_at) : null;
                return (
                  <div key={sub.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all group rounded-md mx-1 my-0.5">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold text-xs border border-white shadow-sm">
                        {sub.candidateName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{sub.candidateName}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                          Level {sub.level} • {subDate ? subDate.toLocaleDateString() : 'Pending'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-widest border ${sub.status === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          sub.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                        {sub.status}
                      </span>
                      <button
                        onClick={() => navigate(`/admin/submission/${sub.id}`)}
                        className="text-slate-300 hover:text-blue-600 transition-colors"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {recentSubmissions.length === 0 && !loading && (
                <div className="py-12 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No recent activity detected</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 animate-fade-in-up delay-400">
            <div className="bg-white rounded-md border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Directives
              </h3>
              <div className="space-y-4">
                <div
                  onClick={() => navigate('/admin/attendance')}
                  className="flex items-center justify-between p-3 rounded-md border border-slate-100 hover:border-blue-100 hover:bg-blue-50/20 transition-all cursor-pointer group"
                >
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Attendance Queue</p>
                    <p className="text-xl font-bold text-slate-900">{stats.pendingAttendance}</p>
                  </div>
                  <div className="text-slate-300 group-hover:text-blue-600 transition-colors">
                    <Calendar size={18} />
                  </div>
                </div>

                <div
                  onClick={() => navigate('/admin/assignment')}
                  className="flex items-center justify-between p-3 rounded-md border border-slate-100 hover:border-blue-100 hover:bg-blue-50/20 transition-all cursor-pointer group"
                >
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Evaluations Pending</p>
                    <p className="text-xl font-bold text-slate-900">{stats.pendingEvaluations}</p>
                  </div>
                  <div className="text-slate-300 group-hover:text-blue-600 transition-colors">
                    <CheckCircle size={18} />
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-slate-50 rounded-md border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-blue-600" />
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Efficiency Benchmark</span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                  Automate faculty grading with Round-Robin allocation for **2x faster** clearance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SaaSLayout>
  );
};

export default AdminDashboard;
