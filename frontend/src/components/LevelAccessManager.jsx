import React, { useState, useEffect } from 'react';
import { Lock, Unlock, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const LevelAccessManager = ({ user, onClose }) => {
    const [courses, setCourses] = useState([]);
    const [levelAccess, setLevelAccess] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        fetchData();
    }, [user.id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all courses
            const coursesRes = await api.get('/courses');
            setCourses(coursesRes.data);

            // Fetch level access for this user
            const accessRes = await api.get(`/level-access/${user.id}`);

            // Convert to map for easy lookup
            const accessMap = {};
            accessRes.data.forEach(item => {
                const key = `${item.course_id}-${item.level}`;
                accessMap[key] = item.is_locked;
            });
            setLevelAccess(accessMap);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load level access data');
        } finally {
            setLoading(false);
        }
    };

    const toggleLevel = async (courseId, level) => {
        const key = `${courseId}-${level}`;
        const isCurrentlyLocked = levelAccess[key] || false;
        const action = isCurrentlyLocked ? 'unlock' : 'lock';

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            await api.post(`/level-access/${action}`, {
                userId: user.id,
                courseId,
                level,
                lockedBy: 'admin'
            });

            // Update local state
            setLevelAccess(prev => ({
                ...prev,
                [key]: !isCurrentlyLocked
            }));

            setSuccessMessage(`Level ${level} ${action}ed successfully`);
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err) {
            console.error(`Error ${action}ing level:`, err);
            setError(`Failed to ${action} level`);
        } finally {
            setSaving(false);
        }
    };

    const bulkToggle = async (courseId, totalLevels, action) => {
        const levels = Array.from({ length: totalLevels }, (_, i) => i + 1);

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            await api.post('/level-access/bulk', {
                userId: user.id,
                courseId,
                levels,
                action,
                lockedBy: 'admin'
            });

            // Update local state
            const updates = {};
            levels.forEach(level => {
                const key = `${courseId}-${level}`;
                updates[key] = action === 'lock';
            });

            setLevelAccess(prev => ({ ...prev, ...updates }));
            setSuccessMessage(`All levels ${action}ed successfully`);
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err) {
            console.error(`Error in bulk ${action}:`, err);
            setError(`Failed to ${action} all levels`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4">
                    <div className="flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-gray-600">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Manage Level Access</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {user.full_name || user.username} ({user.email})
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-sm text-red-700">{error}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-sm text-green-700">{successMessage}</span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {courses.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No courses available
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {courses.map(course => (
                                <div key={course.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-gray-900">{course.title}</h3>
                                            <p className="text-sm text-gray-600">{course.total_levels} levels</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => bulkToggle(course.id, course.total_levels, 'unlock')}
                                                disabled={saving}
                                                className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                            >
                                                <Unlock className="w-4 h-4" />
                                                Unlock All
                                            </button>
                                            <button
                                                onClick={() => bulkToggle(course.id, course.total_levels, 'lock')}
                                                disabled={saving}
                                                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                            >
                                                <Lock className="w-4 h-4" />
                                                Lock All
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {Array.from({ length: course.total_levels }, (_, i) => i + 1).map(level => {
                                                const key = `${course.id}-${level}`;
                                                const isLocked = levelAccess[key] || false;

                                                return (
                                                    <button
                                                        key={level}
                                                        onClick={() => toggleLevel(course.id, level)}
                                                        disabled={saving}
                                                        className={`
                              px-4 py-3 rounded-lg border-2 transition-all
                              flex items-center justify-center gap-2
                              disabled:opacity-50 disabled:cursor-not-allowed
                              ${isLocked
                                                                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                                : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                                            }
                            `}
                                                    >
                                                        {isLocked ? (
                                                            <Lock className="w-4 h-4" />
                                                        ) : (
                                                            <Unlock className="w-4 h-4" />
                                                        )}
                                                        <span className="font-medium">Level {level}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LevelAccessManager;
