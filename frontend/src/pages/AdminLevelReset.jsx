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
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="p-2.5 bg-white rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="text-left">
                        <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">
                            <RefreshCw size={10} />
                            <span>Student Management</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reset Student Level</h1>
                        <p className="text-slate-500 text-sm mt-1">Allow a student to retake an assessment with fresh questions</p>
                    </div>
                </div>

                {/* Message Alert */}
                {message && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                        {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        <span className="font-medium text-sm">{message.text}</span>
                    </div>
                )}

                {/* Selection Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* User Selection */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <User className="text-indigo-500" size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">1. Select Student</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Search by name or email</p>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                                type="text"
                                placeholder="Search students..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-2 relative">
                            {searching && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                                    <RefreshCw className="animate-spin text-indigo-600" size={20} />
                                </div>
                            )}
                            {currentUsers.slice(0, 10).map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={`w-full p-3 rounded-xl text-left transition-all ${selectedUser?.id === user.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                        }`}
                                >
                                    <p className="font-bold text-sm truncate">{user.full_name || user.username}</p>
                                    <p className={`text-[10px] truncate ${selectedUser?.id === user.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                                        {user.email || user.username}
                                    </p>
                                </button>
                            ))}
                            {currentUsers.length === 0 && !searching && (
                                <p className="text-center text-slate-400 text-sm py-4">No users found</p>
                            )}
                        </div>
                    </div>

                    {/* Course Selection */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                                <BookOpen className="text-violet-500" size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">2. Select Course</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Choose the course</p>
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {courses.map(course => (
                                <button
                                    key={course.id}
                                    onClick={() => setSelectedCourse(course)}
                                    className={`w-full p-3 rounded-xl text-left transition-all ${selectedCourse?.id === course.id
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                        }`}
                                >
                                    <p className="font-bold text-sm truncate">{course.title}</p>
                                    <p className={`text-[10px] ${selectedCourse?.id === course.id ? 'text-violet-100' : 'text-slate-400'}`}>
                                        {course.totalLevels || course.total_levels || 1} Levels
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Level Selection */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                <Layers className="text-amber-500" size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">3. Select Level</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Level to reset</p>
                            </div>
                        </div>

                        {selectedCourse ? (
                            <div className="grid grid-cols-4 gap-2">
                                {Array.from({ length: selectedCourse.totalLevels || selectedCourse.total_levels || 12 }, (_, i) => i + 1).map(lv => (
                                    <button
                                        key={lv}
                                        onClick={() => setSelectedLevel(lv)}
                                        className={`py-3 rounded-xl font-black text-sm transition-all ${selectedLevel === lv
                                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                            }`}
                                    >
                                        {lv}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-slate-400 text-sm py-8">Select a course first</p>
                        )}
                    </div>
                </div>

                {/* Summary & Action */}
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-8 rounded-3xl text-white shadow-2xl shadow-rose-200">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="text-left">
                            <h3 className="font-black text-xl flex items-center gap-3">
                                <AlertTriangle size={24} />
                                Reset Confirmation
                            </h3>
                            {selectedUser && selectedCourse ? (
                                <p className="mt-2 text-rose-100">
                                    Reset <strong>Level {selectedLevel}</strong> for <strong>{selectedUser.full_name || selectedUser.username}</strong> in <strong>{selectedCourse.title}</strong>
                                </p>
                            ) : (
                                <p className="mt-2 text-rose-100">Select a student, course, and level above to continue</p>
                            )}
                        </div>

                        <button
                            onClick={handleReset}
                            disabled={!selectedUser || !selectedCourse || resetting}
                            className="px-8 py-4 bg-white text-rose-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-rose-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                        >
                            {resetting ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Resetting...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={18} />
                                    Reset Level
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
}
