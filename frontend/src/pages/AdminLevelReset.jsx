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
            <div className="min-h-screen bg-slate-50/30 -m-8 p-12 font-sans antialiased text-slate-900 overflow-x-hidden">
                {/* Header Section */}
                <div className="mx-auto mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-12">
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-6">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:bg-slate-50 shadow-sm"
                            >
                                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            </button>
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-50 rounded-full border border-rose-100 text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">
                                <RefreshCw size={12} className="animate-spin-slow" />
                                <span>System Maintenance</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
                            Assessment Level Reset
                        </h1>
                        <p className="text-slate-500 font-bold text-lg mt-4 max-w-3xl">
                            Initialize a complete reset for specific student milestones. This action will purge previous attempts and allow for a fresh randomized assessment sequence.
                        </p>
                    </div>

                    {message && (
                        <div className={`flex-shrink-0 p-6 rounded-3xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 shadow-xl ${message.type === 'success'
                            ? 'bg-emerald-600 text-white shadow-emerald-200'
                            : 'bg-rose-600 text-white shadow-rose-200'
                            }`}>
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                {message.type === 'success' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <p className="font-black text-xs uppercase tracking-widest opacity-80">{message.type === 'success' ? 'Operation Success' : 'Critical Alert'}</p>
                                <p className="font-bold text-sm mt-0.5">{message.text}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Execution Grid */}
                <div className="mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Step 1: User Discovery */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group overflow-hidden flex flex-col h-full min-h-[650px]">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
                                        <User size={28} />
                                    </div>
                                    <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest bg-blue-900 px-4 py-2 rounded-full">Step 01</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Identify Student</h3>
                                <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Select target for operation</p>
                            </div>

                            <div className="p-8 space-y-6 flex-1 flex flex-col overflow-hidden">
                                <div className="relative">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Search by signature or identity..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-bold placeholder:text-slate-300 focus:ring-8 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                    {searching && (
                                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                                            <RefreshCw className="animate-spin text-blue-600" size={32} />
                                            <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Scanning Records</p>
                                        </div>
                                    )}
                                    {currentUsers.slice(0, 15).map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => setSelectedUser(user)}
                                            className={`w-full p-5 rounded-2xl text-left border-2 transition-all duration-300 group/item relative overflow-hidden ${selectedUser?.id === user.id
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 scale-[1.02]'
                                                : 'bg-white border-slate-100 hover:border-blue-100 hover:bg-blue-50/50 text-slate-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${selectedUser?.id === user.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                    {user.full_name?.charAt(0) || user.username?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-base truncate leading-tight">{user.full_name || user.username}</p>
                                                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 truncate ${selectedUser?.id === user.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                        {user.email || 'ID: ' + user.id}
                                                    </p>
                                                </div>
                                            </div>
                                            {selectedUser?.id === user.id && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <CheckCircle size={20} className="text-white/50" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                    {currentUsers.length === 0 && !searching && (
                                        <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                            <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No matching identity found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Course Vector */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group overflow-hidden flex flex-col h-full min-h-[650px]">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-200 group-hover:scale-110 transition-transform duration-500">
                                        <BookOpen size={28} />
                                    </div>
                                    <span className="text-[10px] font-black text-violet-200 uppercase tracking-widest bg-violet-900 px-4 py-2 rounded-full">Step 02</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Select Course</h3>
                                <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Define operational context</p>
                            </div>

                            <div className="p-8 space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {courses.map(course => (
                                    <button
                                        key={course.id}
                                        onClick={() => setSelectedCourse(course)}
                                        className={`w-full p-6 rounded-3xl text-left border-2 transition-all duration-300 relative group/card ${selectedCourse?.id === course.id
                                            ? 'bg-violet-600 border-violet-600 text-white shadow-xl shadow-violet-200 scale-[1.02]'
                                            : 'bg-white border-slate-100 hover:border-violet-100 hover:bg-violet-50/50 text-slate-700'
                                            }`}
                                    >
                                        <div className="flex flex-col relative z-10">
                                            <div className="flex items-start justify-between mb-2">
                                                <p className="font-black text-lg leading-tight pr-8">{course.title}</p>
                                                {selectedCourse?.id === course.id && <CheckCircle size={20} className="text-white/50 shrink-0" />}
                                            </div>
                                            <div className="flex items-center gap-4 mt-2">
                                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${selectedCourse?.id === course.id ? 'bg-white/20 text-white' : 'bg-violet-50 text-violet-600'}`}>
                                                    {course.totalLevels || course.total_levels || 1} Milestones
                                                </div>
                                                <div className={`text-[9px] font-black uppercase tracking-widest ${selectedCourse?.id === course.id ? 'text-violet-200' : 'text-slate-300'}`}>
                                                    ID: {course.id.slice(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Level Precision */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group overflow-hidden flex flex-col h-full min-h-[650px]">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform duration-500">
                                        <Layers size={28} />
                                    </div>
                                    <span className="text-[10px] font-black text-amber-100 uppercase tracking-widest bg-amber-900 px-4 py-2 rounded-full">Step 03</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Milestone Rank</h3>
                                <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Select level to purge</p>
                            </div>

                            <div className="p-8 flex-1">
                                {selectedCourse ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-4">
                                        {Array.from({ length: selectedCourse.totalLevels || selectedCourse.total_levels || 12 }, (_, i) => i + 1).map(lv => (
                                            <button
                                                key={lv}
                                                onClick={() => setSelectedLevel(lv)}
                                                className={`aspect-square flex flex-col items-center justify-center rounded-3xl font-black transition-all duration-300 border-2 ${selectedLevel === lv
                                                    ? 'bg-amber-500 border-amber-500 text-white shadow-xl shadow-amber-200 scale-110'
                                                    : 'bg-white border-slate-100 hover:border-amber-100 hover:bg-amber-50 text-slate-600'
                                                    }`}
                                            >
                                                <span className="text-[10px] uppercase opacity-50 mb-1">LVL</span>
                                                <span className="text-2xl leading-none">{lv}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner mb-6">
                                            <AlertTriangle className="text-slate-200" size={40} />
                                        </div>
                                        <h4 className="text-slate-400 font-black text-sm uppercase tracking-widest">Context Required</h4>
                                        <p className="text-slate-300 font-bold text-xs mt-4">Select a course vector in Step 02 to initialize level parameters.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Execution Bar */}
                <div className="mx-auto mt-12 bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-slate-900/40 relative overflow-hidden border border-white/5">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

                    <div className="flex flex-col lg:flex-row items-center justify-between gap-10 relative z-10">
                        <div className="flex-1">
                            <h3 className="text-2xl font-black flex items-center gap-4">
                                <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-400 border border-rose-500/30">
                                    <AlertTriangle size={28} />
                                </div>
                                Operational Execution Manifest
                            </h3>
                            <div className="mt-8 flex flex-wrap gap-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject</p>
                                    <p className="font-black text-lg text-white">{selectedUser ? (selectedUser.full_name || selectedUser.username) : '---'}</p>
                                </div>
                                <div className="w-px h-12 bg-white/10 hidden md:block" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Objective</p>
                                    <p className="font-black text-lg text-white">{selectedCourse ? selectedCourse.title : '---'}</p>
                                </div>
                                <div className="w-px h-12 bg-white/10 hidden md:block" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Milestone</p>
                                    <p className="font-black text-lg text-amber-400">LEVEL {selectedLevel}</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleReset}
                            disabled={!selectedUser || !selectedCourse || resetting}
                            className={`group relative px-12 py-7 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] transition-all duration-500 flex items-center gap-4 overflow-hidden shadow-2xl ${!selectedUser || !selectedCourse
                                ? 'bg-slate-800 text-white/20 cursor-not-allowed opacity-50'
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30 hover:-translate-y-1'
                                }`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            {resetting ? (
                                <>
                                    <RefreshCw size={24} className="animate-spin" />
                                    Purging Data...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={24} className="group-hover:rotate-12 transition-transform" />
                                    Execute Purge
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
}
