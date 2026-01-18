import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    Users,
    BookOpen,
    Settings,
    LogOut,
    Layout,
    FileText,
    Calendar,
    Briefcase,
    Trophy,
    BarChart2,
    Bell,
    Search,
    ChevronLeft,
    ChevronRight,
    User,
    RefreshCw,
    Shield,
    Activity,
    Image as ImageIcon
} from 'lucide-react';
import { clearAdminSession, getUserRole } from '../utils/session';

const SaaSLayout = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isHovered, setHovered] = useState(false);
    const isSidebarOpenEffectively = isSidebarOpen || isHovered;
    const navigate = useNavigate();
    const location = useLocation();
    const role = getUserRole();
    const userData = (() => {
        try {
            const adminUser = localStorage.getItem('adminUser');
            const studentUser = localStorage.getItem('user');
            if (adminUser) return JSON.parse(adminUser);
            if (studentUser) return JSON.parse(studentUser);
            return {
                fullName: localStorage.getItem('fullName'),
                username: localStorage.getItem('username')
            };
        } catch (e) {
            return { username: localStorage.getItem('username') };
        }
    })();

    const theme = {
        admin: {
            accent: 'from-indigo-600 to-violet-600',
            glow: 'shadow-indigo-500/30',
            text: 'text-indigo-500',
            active: 'bg-indigo-600/10 border-indigo-500/20',
            pulse: 'bg-indigo-500 shadow-[0_0_12px_#6366f1]'
        },
        faculty: {
            accent: 'from-emerald-600 to-teal-600',
            glow: 'shadow-emerald-500/30',
            text: 'text-emerald-500',
            active: 'bg-emerald-600/10 border-emerald-500/20',
            pulse: 'bg-emerald-500 shadow-[0_0_12px_#10b981]'
        },
        student: {
            accent: 'from-blue-600 to-sky-600',
            glow: 'shadow-blue-500/30',
            text: 'text-blue-500',
            active: 'bg-blue-600/10 border-blue-500/20',
            pulse: 'bg-blue-500 shadow-[0_0_12px_#3b82f6]'
        }
    }[role] || {
        accent: 'from-slate-700 to-slate-900',
        glow: 'shadow-slate-500/30',
        text: 'text-slate-500',
        active: 'bg-slate-600/10 border-slate-500/20',
        pulse: 'bg-slate-500 shadow-[0_0_12px_#64748b]'
    };

    const handleLogout = () => {
        navigate('/logout');
    };

    const menuItems = {
        admin: [
            { id: 'dashboard', label: 'Dashboard', icon: <Layout size={20} />, path: '/admin/dashboard' },
            { id: 'users', label: 'Users', icon: <Users size={20} />, path: '/admin/users' },
            { id: 'courses', label: 'Courses', icon: <BookOpen size={20} />, path: '/admin/courses' },
            { id: 'attendance', label: 'Attendance', icon: <Calendar size={20} />, path: '/admin/attendance' },
            { id: 'faculty', label: 'Faculty Management', icon: <Briefcase size={20} />, path: '/admin/assignment' },
            { id: 'results', label: 'Master Results', icon: <Trophy size={20} />, path: '/admin/results' },
            { id: 'restrictions', label: 'Restriction Hub', icon: <Shield size={20} />, path: '/admin/restrictions' },
            { id: 'reset', label: 'Reset Level', icon: <RefreshCw size={20} />, path: '/admin/reset-level' },
            { id: 'evaluation', label: 'Evaluation Monitor', icon: <Activity size={20} />, path: '/admin/evaluation-tracker' },
            { id: 'assets', label: 'Media Assets', icon: <ImageIcon size={20} />, path: '/admin/assets' },
        ],
        faculty: [
            { id: 'dashboard', label: 'Overview', icon: <Layout size={20} />, path: '/faculty/dashboard' },
            { id: 'queue', label: 'Pending Reviews', icon: <FileText size={20} />, path: '/faculty/submissions' },
            { id: 'history', label: 'History', icon: <BarChart2 size={20} />, path: '/faculty/history' },
        ],
        student: [
            { id: 'dashboard', label: 'My Courses', icon: <BookOpen size={20} />, path: '/' },
            { id: 'results', label: 'My Results', icon: <Trophy size={20} />, path: '/results' },
            { id: 'profile', label: 'Profile', icon: <User size={20} />, path: '/profile' },
        ]
    };

    const currentMenuItems = menuItems[role] || [];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={`
                    fixed inset-y-0 left-0 z-50 
                    md:relative md:z-30 md:flex
                    bg-[#0f172a] text-slate-300 
                    transition-all duration-500 
                    flex flex-col 
                    shadow-[4px_0_24px_rgba(0,0,0,0.1)] 
                    border-r border-white/5 overflow-hidden
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${isSidebarOpenEffectively ? 'w-64' : 'w-16'}
                `}
            >
                {/* Sidebar Header */}
                <div className="h-20 flex items-center px-3 bg-[#0f172a] overflow-hidden">
                    <div
                        className="flex items-center gap-4 group cursor-pointer transition-all duration-500"
                        onClick={() => {
                            if (role === 'admin') navigate('/admin/dashboard');
                            else if (role === 'faculty') navigate('/faculty/dashboard');
                            else navigate('/');
                        }}
                    >
                        <div className={`w-10 h-10 flex-shrink-0 bg-gradient-to-tr ${theme.accent} rounded-2xl flex items-center justify-center text-white font-black shadow-xl ${theme.glow} group-hover:scale-110 transition-transform duration-300`}>
                            A
                        </div>
                        <div className={`flex flex-col transition-all duration-500 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
                            <span className="font-black text-lg tracking-tight text-white leading-none uppercase whitespace-nowrap">Portal</span>
                            <span className={`text-[10px] font-black tracking-[0.2em] ${theme.text} mt-1 uppercase whitespace-nowrap`}>{role}</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar Content */}
                <nav className={`flex-1 py-8 px-3 space-y-2 overflow-y-auto hide-scrollbar transition-all duration-500`}>
                    {currentMenuItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${isActive
                                    ? 'bg-blue-600/10 text-white border border-blue-500/20'
                                    : 'hover:bg-white/5 hover:text-white border border-transparent'
                                    }`}
                            >
                                <div className="w-10 flex-shrink-0 flex items-center justify-center">
                                    <span className={`${isActive ? theme.text : 'text-slate-500 group-hover:text-blue-400'} transition-colors duration-300`}>
                                        {item.icon}
                                    </span>
                                </div>
                                <span className={`font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all duration-500 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none w-0'} ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                    {item.label}
                                </span>
                                {isActive && isSidebarOpenEffectively && (
                                    <div className={`absolute right-4 w-1.5 h-1.5 rounded-full ${theme.pulse} animate-pulse`} />
                                )}
                                {isActive && !isSidebarOpenEffectively && (
                                    <div className={`absolute left-0 w-1 h-8 ${theme.pulse} rounded-r-full`} />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-3 border-t border-white/5 bg-[#0f172a]/50">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 py-4 rounded-2xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-300 font-bold text-xs uppercase tracking-widest group"
                    >
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                            <LogOut size={18} />
                        </div>
                        <span className={`whitespace-nowrap transition-all duration-500 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none w-0'}`}>
                            Secure Logout
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-500`}>
                {/* Top Navigation */}
                <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 md:px-10 z-20 sticky top-0">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            className="bg-slate-50 p-2.5 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all active:scale-90 border border-slate-200/50"
                        >
                            {isSidebarOpenEffectively ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                        </button>

                        <div className="hidden lg:flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>{role}</span>
                                <ChevronRight size={10} className="text-slate-300" />
                                <span className={theme.text}>{location.pathname.split('/').pop() || 'Home'}</span>
                                <span className="mx-2 text-slate-300">/</span>
                                <span className="text-slate-400 font-medium">Session Active</span>
                            </div>
                            <h2 className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
                                {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard Overview'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden md:flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-200/50 group focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:bg-white transition-all">
                            <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search resources..."
                                className="bg-transparent border-none focus:ring-0 text-sm w-48 text-slate-600 font-medium placeholder:text-slate-300"
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <button className="relative p-2.5 text-slate-400 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-xl">
                                <Bell size={20} />
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full border-2 border-white ring-2 ring-blue-100" />
                            </button>

                            <div className="h-10 w-[1px] bg-slate-200 hidden sm:block" />

                            <div className="flex items-center gap-4 group cursor-pointer pl-2">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-black text-slate-900 leading-none group-hover:text-blue-600 transition-colors">
                                        {userData.fullName || userData.username || 'System User'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center justify-end gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        ONLINE
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-[1.25rem] bg-slate-900 flex items-center justify-center text-white font-black shadow-2xl shadow-slate-900/10 group-hover:rotate-6 transition-all duration-500 relative ring-4 ring-white">
                                    {(userData.fullName || userData.username || 'U').charAt(0).toUpperCase()}
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-white shadow-sm`} />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .hide-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      ` }} />
        </div>
    );
};

export default SaaSLayout;
