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
    Clock,
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
    Image as ImageIcon,
    Database,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SaaSLayout = ({ children, fullWidth = false }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isHovered, setHovered] = useState(false);
    const isSidebarOpenEffectively = isSidebarOpen || isHovered;
    const navigate = useNavigate();
    const location = useLocation();
    const { role, user: authUser } = useAuth();
    const userData = (() => {
        if (authUser) return authUser;
        // Fallback to non-sensitive localStorage display data
        return {
            fullName: localStorage.getItem('fullName'),
            username: 'User',
            rollNo: localStorage.getItem('rollNo')
        };
    })();

    const handleLogout = () => {
        navigate('/logout');
    };

    const adminItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <Layout size={20} />, path: '/admin/dashboard' },
        { id: 'users', label: 'Users', icon: <Users size={20} />, path: '/admin/users' },
        { id: 'courses', label: 'Courses', icon: <BookOpen size={20} />, path: '/admin/courses' },
        { id: 'attendance', label: 'Attendance', icon: <Calendar size={20} />, path: '/admin/attendance' },
        { id: 'schedule', label: 'Schedule', icon: <Clock size={20} />, path: '/admin/schedule' },
        { id: 'faculty', label: 'Faculty', icon: <Briefcase size={20} />, path: '/admin/assignment' },
        { id: 'results', label: 'Results', icon: <Trophy size={20} />, path: '/admin/results' },
        { id: 'restrictions', label: 'Restrictions', icon: <Shield size={20} />, path: '/admin/restrictions' },
        { id: 'reset', label: 'Reset Level', icon: <RefreshCw size={20} />, path: '/admin/reset-level' },
        { id: 'assets', label: 'Assets', icon: <ImageIcon size={20} />, path: '/admin/assets' },
        { id: 'bulk-completion', label: 'Bulk Unlock', icon: <Database size={20} />, path: '/admin/bulk-completion' },
        { id: 'violations', label: 'Violations', icon: <AlertTriangle size={20} />, path: '/admin/violations' },
        { id: 'backup', label: 'Backup', icon: <Database size={20} />, path: '/admin/backup' },
    ];

    // Access Control only for Master Admin
    if (userData.is_master || userData.isMaster) {
        adminItems.push({ id: 'access-control', label: 'Access Control', icon: <Shield size={20} />, path: '/admin/access-control' });
    }

    const menuItems = {
        admin: adminItems.filter(item => {
            if (item.id === 'dashboard' || item.id === 'access-control') return true;
            if (userData.is_master || userData.isMaster) return true;

            // Check permissions array
            let perms = userData.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { perms = null; }
            }
            // If perms is fundamentally null or undefined, fallback to old behavior (show all)
            if (!Array.isArray(perms)) return true;
            // Otherwise, strictly enforce the array (even if empty)
            return perms.includes(item.id);
        }),
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
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
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
                    bg-white border-r border-slate-200 shadow-xl md:shadow-none
                    transition-all duration-300 ease-in-out
                    flex flex-col 
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${isSidebarOpenEffectively ? 'w-72' : 'w-20'}
                `}
            >
                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-center border-b border-slate-100">
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => {
                            if (role === 'admin') navigate('/admin/dashboard');
                            else if (role === 'faculty') navigate('/faculty/dashboard');
                            else navigate('/');
                        }}
                    >
                        <div className={`w-8 h-8 flex-shrink-0 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105 duration-300 shadow-sm shadow-blue-200`}>
                            <span className="text-lg">P</span>
                        </div>
                        <div className={`transition-all duration-300 overflow-hidden ${isSidebarOpenEffectively ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                            <span className="font-bold text-base text-slate-800 tracking-tight">Portal</span>
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
                                className={`flex items-center gap-3 py-2 px-3 rounded-md transition-all duration-200 group relative ${isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                    : 'text-slate-500 hover:bg-blue-50/50 hover:text-blue-600 font-medium'
                                    }`}
                            >
                                <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                    {isActive ? React.cloneElement(item.icon, { fill: "currentColor", fillOpacity: 0.2 }) : item.icon}
                                </div>
                                <span className={`text-sm font-black whitespace-nowrap transition-all duration-300 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none w-0'}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/40 rounded-r-full" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 py-2 px-3 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 group"
                    >
                        <div className="transition-transform duration-300 group-hover:-translate-x-1">
                            <LogOut size={20} />
                        </div>
                        <span className={`text-sm font-black whitespace-nowrap transition-all duration-300 ${isSidebarOpenEffectively ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none w-0'}`}>
                            Logout
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-500`}>
                {/* Top Navigation */}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-8 z-20 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-all duration-200 active:scale-95"
                        >
                            {isSidebarOpenEffectively ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                        </button>

                        <div className="hidden lg:flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{role}</span>
                            <span className="text-slate-300">/</span>
                            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                                {location.pathname.split('/').filter(Boolean).pop()?.split('-').join(' ') || 'Dashboard'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md focus-within:ring-2 focus-within:ring-slate-200 focus-within:bg-white transition-all w-64">
                            <Search size={14} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-transparent border-none focus:ring-0 text-xs w-full text-slate-600 placeholder:text-slate-400 font-medium"
                            />
                        </div>

                        <div className="h-8 w-px bg-slate-200 hidden sm:block" />

                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right hidden sm:block leading-tight">
                                <p className="text-xs font-bold text-slate-800">
                                    {userData.fullName || userData.username || 'User'}
                                </p>
                                {userData.rollNo && (
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        ID: {userData.rollNo}
                                    </p>
                                )}
                            </div>
                            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                                {(userData.fullName || userData.username || 'U').charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className={`flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50 ${fullWidth ? 'p-0' : 'p-4 md:p-6'}`}>
                    <div className={`w-full h-full mx-auto ${fullWidth ? 'max-w-none' : 'max-w-[1600px]'}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SaaSLayout;
