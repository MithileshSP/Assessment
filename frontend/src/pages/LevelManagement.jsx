import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { Loader2, AlertCircle, CheckCircle2, RotateCcw, User, Layers, Book } from 'lucide-react';
import api from '../services/api';

export default function LevelManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');

    const [user, setUser] = useState(null);
    const [courses, setCourses] = useState([]);
    const [userProgress, setUserProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        if (!userId) {
            navigate('/admin/dashboard');
            return;
        }
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [userRes, coursesRes, progressRes] = await Promise.all([
                api.get(`/users/${userId}`),
                api.get('/courses'),
                api.get(`/courses/progress/${userId}`)
            ]);
            setUser(userRes.data);
            setCourses(coursesRes.data);
            setUserProgress(progressRes.data);
        } catch (err) {
            setError('Failed to load level access data');
        } finally {
            setLoading(false);
        }
    };

    const resetLevel = async (courseId, level) => {
        if (!window.confirm(`Are you sure you want to reset Level ${level} progress for this user?`)) return;
        try {
            setSaving(true);
            await api.post('/level-access/reset', { userId, courseId, level });
            if (userProgress) {
                const updatedCourses = userProgress.courses.map(c => {
                    if (c.courseId === courseId) {
                        return { ...c, completedLevels: c.completedLevels.filter(l => l !== level) };
                    }
                    return c;
                });
                setUserProgress({ ...userProgress, courses: updatedCourses });
            }
            setSuccessMessage(`Level ${level} reset successfully`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset level');
        } finally {
            setSaving(false);
        }
    };

    const getCompletionStatus = (courseId, level) => {
        if (!userProgress) return false;
        const course = userProgress.courses?.find(c => c.courseId === courseId);
        return course?.completedLevels?.includes(level) || false;
    };

    if (loading) return (
        <SaaSLayout>
            <div className="flex flex-col items-center justify-center py-40">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Progress Registry...</p>
            </div>
        </SaaSLayout>
    );

    return (
        <SaaSLayout>
            <div className="space-y-8 text-left">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Progress Custodian</h1>
                        <p className="text-slate-500 mt-1">Directly manage and reset individual candidate level access.</p>
                    </div>
                </div>

                {/* Account Summary Card */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center gap-8 shadow-xl shadow-slate-900/10">
                    <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                        <User size={40} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-2xl font-bold">{user?.full_name || user?.username || username}</h2>
                        <p className="text-slate-400 text-sm font-medium mt-1">{user?.email || 'No email associated'}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                            <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-300">UID: {userId}</span>
                            <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-300">Status: Active</span>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-shake">
                        <AlertCircle size={18} /> {error}
                    </div>
                )}
                {successMessage && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm font-bold">
                        <CheckCircle2 size={18} /> {successMessage}
                    </div>
                )}

                {/* Course Matrix */}
                <div className="space-y-10">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                                        <Book size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 lg:text-md uppercase tracking-widest">{course.title}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Layers size={12} className="text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{course.totalLevels} Module Architecture</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {Array.from({ length: course.totalLevels }, (_, i) => i + 1).map(level => {
                                        const isCompleted = getCompletionStatus(course.id, level);
                                        return (
                                            <div
                                                key={level}
                                                className={`group relative p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3
                                                    ${isCompleted
                                                        ? 'border-emerald-100 bg-emerald-50/30 text-emerald-700'
                                                        : 'border-slate-100 bg-slate-50/50 text-slate-300'}
                                                `}
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Level</span>
                                                <span className="text-3xl font-black">{level}</span>

                                                {isCompleted ? (
                                                    <button
                                                        onClick={() => resetLevel(course.id, level)}
                                                        disabled={saving}
                                                        className="mt-2 p-2 bg-white text-rose-500 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 hover:scale-110"
                                                        title="Sanitize Progress"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                ) : (
                                                    <div className="h-10 invisible" />
                                                )}

                                                {isCompleted && (
                                                    <div className="absolute top-2 right-2 text-emerald-500">
                                                        <CheckCircle2 size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {courses.length === 0 && (
                        <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                            No Active Course Architectures Found
                        </div>
                    )}
                </div>
            </div>
        </SaaSLayout>
    );
}
