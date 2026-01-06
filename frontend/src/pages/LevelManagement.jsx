import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
            setError(null);

            // Fetch user details
            const userRes = await api.get(`/users/${userId}`);
            setUser(userRes.data);

            // Fetch all courses
            const coursesRes = await api.get('/courses');
            setCourses(coursesRes.data);

            // Fetch progress
            const progressRes = await api.get(`/courses/progress/${userId}`);
            setUserProgress(progressRes.data);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load level access data');
        } finally {
            setLoading(false);
        }
    };

    const resetLevel = async (courseId, level) => {
        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            await api.post('/level-access/reset', {
                userId,
                courseId,
                level
            });

            // Update local state - remove the level from completedLevels
            if (userProgress) {
                const updatedCourses = userProgress.courses.map(c => {
                    if (c.courseId === courseId) {
                        return {
                            ...c,
                            completedLevels: c.completedLevels.filter(l => l !== level)
                        };
                    }
                    return c;
                });
                setUserProgress({ ...userProgress, courses: updatedCourses });
            }

            setSuccessMessage(`Level ${level} reset successfully`);
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err) {
            console.error('Error resetting level:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to reset level';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const getCompletionStatus = (courseId, level) => {
        if (!userProgress) return false;
        const course = userProgress.courses?.find(c => c.courseId === courseId);
        return course?.completedLevels?.includes(level) || false;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-gray-600">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Manage Level Access</h1>
                    <p className="text-gray-600 mt-2">
                        {user?.full_name || user?.username || username} ({user?.email || 'No email'})
                    </p>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                        <span className="text-sm text-red-700">{error}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                        <span className="text-sm text-green-700">{successMessage}</span>
                    </div>
                )}

                {/* Courses */}
                {courses.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                        No courses available
                    </div>
                ) : (
                    <div className="space-y-6">
                        {courses.map(course => (
                            <div key={course.id} className="bg-white rounded-lg shadow overflow-hidden">
                                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b">
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">{course.title}</h2>
                                        <p className="text-sm text-gray-600 mt-1">{course.total_levels} levels</p>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {Array.from({ length: course.total_levels }, (_, i) => i + 1).map(level => {
                                            const isCompleted = getCompletionStatus(course.id, level);

                                            return (
                                                <div
                                                    key={level}
                                                    className={`
                                                        rounded-lg border-2 transition-all p-4
                                                        flex flex-col items-center justify-center gap-2
                                                        ${isCompleted
                                                            ? 'border-green-300 bg-green-50 text-green-700'
                                                            : 'border-gray-200 bg-gray-50 text-gray-500'}
                                                    `}
                                                >
                                                    <span className="font-semibold">Level {level}</span>

                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-xs">{isCompleted ? 'Cleared' : 'Incomplete'}</span>

                                                        {isCompleted && (
                                                            <div className="mt-1 flex flex-col items-center">
                                                                <button
                                                                    onClick={() => resetLevel(course.id, level)}
                                                                    disabled={saving}
                                                                    className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 underline disabled:opacity-50 pointer-events-auto"
                                                                >
                                                                    Reset Progress
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
