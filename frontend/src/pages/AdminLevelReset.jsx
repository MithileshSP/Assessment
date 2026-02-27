import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    ArrowLeft,
    User,
    BookOpen,
    Layers,
    Trash2
} from 'lucide-react';
import SaaSLayout from '../components/SaaSLayout';
import * as api from '../services/api';

export default function AdminLevelReset() {
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState(1);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersRes, coursesRes] = await Promise.all([
                api.default.get('/users', { params: { limit: 100 } }),
                api.getCourses()
            ]);
            setUsers(usersRes.data.users || []);
            setCourses(coursesRes.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            setMessage({ type: 'error', text: 'Failed to load users/courses' });
        } finally {
            setLoading(false);
        }
    };

    // Server-side search for users
    useEffect(() => {
        if (!searchTerm) return;

        const delayDebounceFn = setTimeout(async () => {
            try {
                setSearching(true);
                const res = await api.default.get('/users', {
                    params: { search: searchTerm, limit: 10 }
                });
                setUsers(res.data.users || []);
            } catch (err) {
                console.error('Search failed:', err);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const currentUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleReset = async () => {
        if (!selectedUser || !selectedCourse || !selectedLevel) {
            setMessage({ type: 'error', text: 'Please select a user, course, and level' });
            return;
        }

        const confirmMsg = `Are you sure you want to reset Level ${selectedLevel} for "${selectedUser.full_name || selectedUser.username}" in "${selectedCourse.title}"?\n\nThis will:\n• Delete all submissions for this level\n• Clear question assignments\n• Clear test sessions\n• Allow student to take a fresh test with new questions`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setResetting(true);
            setMessage(null);

            await api.resetLevel(selectedUser.id, selectedCourse.id, selectedLevel);

            setMessage({
                type: 'success',
                text: `Successfully reset Level ${selectedLevel} for ${selectedUser.username}. They will receive new random questions on next attempt.`
            });

            // Clear selections
            setSelectedUser(null);
            setSelectedCourse(null);
            setSelectedLevel(1);
            setSearchTerm('');

        } catch (error) {
            console.error('Reset failed:', error);
            setMessage({ type: 'error', text: 'Failed to reset level: ' + (error.response?.data?.error || error.message) });
        } finally {
            setResetting(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-800 flex flex-col items-center">
                <div className="w-full max-w-7xl space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 shadow-sm">
                                <RefreshCw size={12} className="animate-spin-slow" />
                                <span>Progress Management</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                                Reset Assessment Level
                            </h1>
                            <p className="text-slate-500 font-medium mt-2 max-w-2xl text-sm md:text-base">
                                Select a student, assign a course, and pick a specific level milestone to clear. This allows the student to retake that level with a freshly generated environment and questions.
                            </p>
                        </div>

                        {message && (
                            <div className={`flex items-start md:items-center gap-3 px-5 py-4 w-full md:w-auto rounded-2xl shadow-sm border animate-in slide-in-from-top-4 duration-300 ${message.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                                }`}>
                                <div className="shrink-0 mt-0.5 md:mt-0">
                                    {message.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-rose-500" />}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest opacity-60 mb-0.5">{message.type === 'success' ? 'Success' : 'Error'}</p>
                                    <p className="text-sm font-bold leading-tight">{message.text}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Column 1: Student */}
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[550px] overflow-hidden transition-all hover:shadow-lg group">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Student</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 01</p>
                                    </div>
                                </div>
                                {selectedUser && <CheckCircle className="text-emerald-500" size={24} />}
                            </div>

                            <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold placeholder:font-medium placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {searching && (
                                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                                            <RefreshCw className="animate-spin text-blue-500" size={28} />
                                            <p className="text-xs font-bold text-slate-400">Searching...</p>
                                        </div>
                                    )}
                                    {currentUsers.slice(0, 15).map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => setSelectedUser(user)}
                                            className={`w-full p-4 rounded-2xl text-left border transition-all duration-200 ${selectedUser?.id === user.id
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-600 ring-offset-2'
                                                : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-slate-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${selectedUser?.id === user.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {user.full_name?.charAt(0) || user.username?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-sm truncate">{user.full_name || user.username}</p>
                                                    <p className={`text-[11px] mt-0.5 truncate font-medium ${selectedUser?.id === user.id ? 'text-blue-100' : 'text-slate-400'
                                                        }`}>
                                                        {user.email || 'ID: ' + user.id}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {!searching && currentUsers.length === 0 && (
                                        <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                            <p className="text-sm font-bold text-slate-400">No students found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Course */}
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[550px] overflow-hidden transition-all hover:shadow-lg group">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                                        <BookOpen size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Course</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 02</p>
                                    </div>
                                </div>
                                {selectedCourse && <CheckCircle className="text-emerald-500" size={24} />}
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {courses.map(course => (
                                    <button
                                        key={course.id}
                                        onClick={() => setSelectedCourse(course)}
                                        className={`w-full p-5 rounded-2xl text-left border transition-all duration-200 ${selectedCourse?.id === course.id
                                            ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-600 ring-offset-2'
                                            : 'bg-white border-slate-100 hover:border-violet-200 hover:bg-violet-50 text-slate-700'
                                            }`}
                                    >
                                        <p className="font-bold text-base leading-tight pr-4">{course.title}</p>
                                        <div className={`mt-3 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${selectedCourse?.id === course.id ? 'bg-white/20 text-white' : 'bg-violet-50 text-violet-600'
                                            }`}>
                                            {course.totalLevels || course.total_levels || 1} Levels
                                        </div>
                                    </button>
                                ))}
                                {courses.length === 0 && (
                                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <p className="text-sm font-bold text-slate-400">No courses available.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 3: Level */}
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[550px] overflow-hidden transition-all hover:shadow-lg group">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                                        <Layers size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Milestone</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 03</p>
                                    </div>
                                </div>
                                {selectedLevel && <CheckCircle className="text-emerald-500" size={24} />}
                            </div>

                            <div className="p-6 flex-1 flex flex-col justify-start overflow-y-auto custom-scrollbar">
                                {selectedCourse ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-3 pt-2">
                                        {Array.from({ length: selectedCourse.totalLevels || selectedCourse.total_levels || 12 }, (_, i) => i + 1).map(lv => (
                                            <button
                                                key={lv}
                                                onClick={() => setSelectedLevel(lv)}
                                                className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-black transition-all duration-200 border ${selectedLevel === lv
                                                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.05]'
                                                    : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 hover:scale-100'
                                                    }`}
                                            >
                                                <span className="text-[9px] uppercase font-bold opacity-75 mb-0.5 tracking-widest">Level</span>
                                                <span className="text-2xl leading-none">{lv}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        <Layers className="opacity-20 mb-4" size={40} />
                                        <p className="text-sm font-bold">Select a course in Step 02 to view available levels.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Footer Bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                        {/* Soft Ambient Background Elements */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full md:w-auto">
                            {/* Summary Chips */}
                            <div className="flex items-center gap-3 w-full sm:w-auto p-3 sm:p-0 bg-slate-800/50 sm:bg-transparent rounded-xl sm:rounded-none">
                                <div className="p-2 sm:p-0 bg-slate-700 sm:bg-transparent rounded-lg">
                                    <User size={16} className="text-slate-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Target Student</span>
                                    <span className="text-sm text-white font-bold truncate max-w-[150px] sm:max-w-[120px] lg:max-w-[180px]">
                                        {selectedUser ? (selectedUser.full_name || selectedUser.username) : 'None Selected'}
                                    </span>
                                </div>
                            </div>

                            <div className="hidden sm:block w-px h-10 bg-slate-700/50" />

                            <div className="flex items-center gap-3 w-full sm:w-auto p-3 sm:p-0 bg-slate-800/50 sm:bg-transparent rounded-xl sm:rounded-none">
                                <div className="p-2 sm:p-0 bg-slate-700 sm:bg-transparent rounded-lg">
                                    <BookOpen size={16} className="text-slate-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Target Course</span>
                                    <span className="text-sm text-white font-bold truncate max-w-[150px] sm:max-w-[120px] lg:max-w-[180px]">
                                        {selectedCourse ? selectedCourse.title : 'None Selected'}
                                    </span>
                                </div>
                            </div>

                            <div className="hidden sm:block w-px h-10 bg-slate-700/50" />

                            <div className="flex items-center gap-3 w-full sm:w-auto p-3 sm:p-0 bg-slate-800/50 sm:bg-transparent rounded-xl sm:rounded-none">
                                <div className="p-2 sm:p-0 bg-amber-500/20 sm:bg-transparent rounded-lg">
                                    <Layers size={16} className="text-amber-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Milestone</span>
                                    <span className="text-sm text-amber-400 font-black">
                                        {selectedLevel ? `Level ${selectedLevel}` : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Execute Button */}
                        <button
                            onClick={handleReset}
                            disabled={!selectedUser || !selectedCourse || resetting}
                            className={`relative z-10 w-full md:w-auto px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 ${!selectedUser || !selectedCourse || resetting
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 hover:-translate-y-0.5 active:translate-y-0'
                                }`}
                        >
                            {resetting ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={18} />
                                    Reset Progress
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </SaaSLayout>
    );
}
