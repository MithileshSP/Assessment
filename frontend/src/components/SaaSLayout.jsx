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
            accent: 'from-indigo-600 to-indigo-800',
            glow: 'shadow-indigo-500/30',
            text: 'text-indigo-500',
            active: 'bg-indigo-600/10 border-indigo-500/20',
            pulse: 'bg-indigo-500 shadow-[0_0_12px_#6366f1]'
        },
        faculty: {
            accent: 'from-emerald-600 to-emerald-800',
            glow: 'shadow-emerald-500/30',
            text: 'text-emerald-500',
            active: 'bg-emerald-600/10 border-emerald-500/20',
            pulse: 'bg-emerald-500 shadow-[0_0_12px_#10b981]'
        },
        student: {
            accent: 'from-primary-600 to-primary-800',
            glow: 'shadow-primary-500/30',
            text: 'text-primary-500',
            active: 'bg-primary-600/10 border-primary-500/20',
            pulse: 'bg-primary-500 shadow-[0_0_12px_#0e8ce9]'
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
            { id: 'faculty', label: 'Assignment', icon: <Briefcase size={20} />, path: '/admin/assignment' },
            { id: 'results', label: 'Results', icon: <Trophy size={20} />, path: '/admin/results' },
            { id: 'restrictions', label: 'Restrictions', icon: <Shield size={20} />, path: '/admin/restrictions' },
            { id: 'reset', label: 'Reset Level', icon: <RefreshCw size={20} />, path: '/admin/reset-level' },
            { id: 'tracker', label: 'Evaluation Tracker', icon: <Activity size={20} />, path: '/admin/evaluation-tracker' },
            { id: 'assets', label: 'Assets', icon: <ImageIcon size={20} />, path: '/admin/assets' },
        ],
        faculty: [
            { id: 'dashboard', label: 'Dashboard', icon: <Layout size={20} />, path: '/faculty/dashboard' },
            { id: 'questions', label: 'Questions', icon: <BookOpen size={20} />, path: '/faculty/questions' },
            { id: 'queue', label: 'Submissions', icon: <FileText size={20} />, path: '/faculty/submissions' },
            { id: 'history', label: 'History', icon: <BarChart2 size={20} />, path: '/faculty/history' },
        ],
        student: [
            { id: 'dashboard', label: 'Dashboard', icon: <BookOpen size={20} />, path: '/' },
            { id: 'results', label: 'Results', icon: <Trophy size={20} />, path: '/results' },
            { id: 'profile', label: 'Profile', icon: <User size={20} />, path: '/profile' },
        ]
    };

    const currentMenuItems = menuItems[role] || [];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
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
                    transition-all duration-300
                    flex flex-col 
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${isSidebarOpenEffectively ? 'w-64' : 'w-20'}
                `}
            >
                {/* Sidebar Header */}
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => {
                            if (role === 'admin') navigate('/admin/dashboard');
                            else if (role === 'faculty') navigate('/faculty/dashboard');
                            else navigate('/');
                        }}
                    >
                        <div className={`w-8 h-8 flex-shrink-0 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold`}>
                            P
                        </div>
                        <div className={`transition-all duration-300 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
                            <span className="font-bold text-lg text-white">Portal</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar Content */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
                    {currentMenuItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-4 py-3 px-3 rounded-xl transition-all duration-200 group relative ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="w-6 flex-shrink-0 flex items-center justify-center">
                                    {isActive ? item.icon : React.cloneElement(item.icon, { size: 20 })}
                                </div>
                                <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none w-0'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 py-3 px-3 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200 group"
                    >
                        <div className="w-6 flex-shrink-0 flex items-center justify-center">
                            <LogOut size={20} />
                        </div>
                        <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none w-0'}`}>
                            Logout
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-500`}>
                {/* Top Navigation */}
                <header className="h-24 bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 flex items-center justify-between px-8 md:px-12 z-20 sticky top-0 shadow-sm">
                    <div className="flex items-center gap-10">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            className="bg-slate-50 p-3.5 hover:bg-white rounded-2xl text-slate-600 transition-all active:scale-95 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-primary-100 group"
                        >
                            {isSidebarOpenEffectively ? <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform" /> : <ChevronRight size={22} className="group-hover:translate-x-0.5 transition-transform" />}
                        </button>

                        <div className="hidden lg:flex flex-col">
                            <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">
                                <span className="hover:text-primary-600 transition-colors cursor-default">{role} system</span>
                                <ChevronRight size={10} className="text-slate-300" />
                                <span className={`${theme.text} font-black`}>{location.pathname.split('/').filter(Boolean).pop()?.replace('-', ' ') || 'Home'}</span>
                            </div>
                            <h2 className="text-xl font-display font-bold text-slate-900 tracking-tight capitalize">
                                {location.pathname.split('/').filter(Boolean).pop()?.split('-').join(' ') || 'Main Dashboard'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-10">
                        <div className="hidden md:flex items-center gap-4 bg-slate-50 border border-slate-200/60 pl-6 pr-4 py-3.5 rounded-2xl shadow-inner group focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:bg-white transition-all">
                            <Search size={18} className="text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search repository..."
                                className="bg-transparent border-none focus:ring-0 text-sm w-56 text-slate-600 font-semibold placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex items-center gap-6">
                            <button className="relative p-3.5 text-slate-400 hover:text-primary-600 transition-all hover:bg-primary-50 rounded-2xl border border-transparent hover:border-primary-100 group">
                                <Bell size={22} className="group-hover:rotate-12 transition-transform" />
                                <span className="absolute top-3.5 right-3.5 w-3 h-3 bg-primary-600 rounded-full border-[3px] border-white ring-4 ring-primary-100 animate-pulse" />
                            </button>

                            <div className="h-12 w-[1px] bg-slate-200 hidden sm:block" />

                            <div className="flex items-center gap-4 group cursor-pointer pl-2">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-display font-bold text-slate-900 leading-none mb-2 group-hover:text-primary-600 transition-colors">
                                        {userData.fullName || userData.username || 'Unidentified User'}
                                    </p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        System Online
                                    </p>
                                </div>
                                <div className="w-14 h-14 rounded-[1.5rem] bg-slate-950 flex items-center justify-center text-white font-display font-black text-xl shadow-2xl shadow-slate-950/20 group-hover:rotate-6 transition-all duration-500 relative ring-4 ring-white border border-white/10 group-hover:scale-105">
                                    {(userData.fullName || userData.username || 'U').charAt(0).toUpperCase()}
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-8 md:p-12 lg:p-16 custom-scrollbar relative">
                    <div className="w-full max-w-[1920px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SaaSLayout;
