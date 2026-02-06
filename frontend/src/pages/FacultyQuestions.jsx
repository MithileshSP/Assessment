import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    BookOpen,
    ArrowRight,
    Search,
    Database
} from 'lucide-react';

const FacultyQuestions = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const res = await api.get('/courses');
            setCourses(res.data);
        } catch (error) {
            console.error("Failed to load courses", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCourses = courses.filter(course =>
        course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <SaaSLayout>
            <div className="space-y-8 text-left">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">
                            <Database size={10} />
                            <span>Question Management</span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Question Repositories</h1>
                        <p className="text-slate-500 mt-1">Manage question banks and assessment content for all active courses.</p>
                    </div>

                    <div className="w-full md:w-72 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Filter courses..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Courses Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">
                            Loading course registries...
                        </div>
                    ) : filteredCourses.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 italic text-slate-400">
                            {searchTerm ? 'No courses match your search criteria.' : 'No active courses available for management.'}
                        </div>
                    ) : (
                        filteredCourses.map(course => (
                            <div key={course.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-emerald-300 transition-all group flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm bg-slate-100 overflow-hidden border border-slate-100">
                                            {course.thumbnail ? (
                                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <BookOpen className="text-slate-300" size={24} />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {course.totalLevels && (
                                                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">
                                                    {course.totalLevels} Stages
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors uppercase text-sm tracking-tight">{course.title}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-3 mb-8 leading-relaxed">{course.description}</p>
                                </div>

                                <button
                                    onClick={() => navigate(`/admin/course/${course.id}/questions`)}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-900 hover:text-white transition-all border border-slate-100 group/btn"
                                >
                                    Access Question Bank
                                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Info Note */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Database size={80} />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h3 className="text-lg font-bold mb-2">Faculty Guidelines</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Questions added here will be available for student assessments. Please ensure all question assets (images, icons) are correctly linked and that the expected results match the provided solution keys.
                        </p>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default FacultyQuestions;
