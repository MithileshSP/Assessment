import React, { useState, useEffect } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api, { updateCourseRestrictions } from '../services/api';
import {
    Shield,
    Lock,
    Unlock,
    Copy,
    Clipboard,
    Maximize,
    AlertTriangle,
    Save,
    ChevronRight,
    Search,
    BookOpen,
    Check,
    RefreshCw
} from 'lucide-react';

const RestrictionManagement = () => {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [restrictions, setRestrictions] = useState({
        blockCopy: true,
        blockPaste: true,
        forceFullscreen: true,
        maxViolations: 3,
        timeLimit: 0
    });

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const res = await api.get('/courses');
            setCourses(res.data);
            if (res.data.length > 0) {
                handleSelectCourse(res.data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch courses', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCourse = async (course) => {
        setSelectedCourse(course);
        try {
            const res = await api.get(`/courses/${course.id}/restrictions`);
            setRestrictions(res.data);
        } catch (error) {
            console.error('Failed to fetch restrictions', error);
            // Fallback to defaults
            setRestrictions({
                blockCopy: true,
                blockPaste: true,
                forceFullscreen: true,
                maxViolations: 3,
                timeLimit: 0
            });
        }
    };

    const handleSave = async () => {
        if (!selectedCourse) return;
        try {
            setSaving(true);
            await updateCourseRestrictions(selectedCourse.id, restrictions);
            alert('Security policies updated successfully');
        } catch (error) {
            alert('Failed to update restrictions');
        } finally {
            setSaving(false);
        }
    };

    const toggleRestriction = (key) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const filteredCourses = courses.filter(c =>
        (c.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (String(c.id || '').toLowerCase()).includes(searchQuery.toLowerCase())
    );

    return (
        <SaaSLayout>
            <div className="min-h-screen bg-[#F8FAFC]/30 -m-8 p-8 font-sans antialiased text-slate-900">
                {/* Header */}
                <div className="max-w-7xl mx-auto mb-10">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-10 border-b border-slate-200/60">
                        <div className="text-left">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
                                    <Shield size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full">
                                    Security Enforcement Console
                                </span>
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 mb-2">
                                Restriction Hub
                            </h1>
                            <p className="text-slate-500 font-medium text-lg max-w-2xl">
                                Configure global exam security policies and structural integrity blocks course-by-course.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Course Selection Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                            <div className="p-6 border-b border-slate-50">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-600 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search courses..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-rose-600 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="p-12 text-center">
                                        <div className="w-8 h-8 border-2 border-rose-100 border-t-rose-600 rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Repository...</p>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-1">
                                        {filteredCourses.map(course => (
                                            <button
                                                key={course.id}
                                                onClick={() => handleSelectCourse(course)}
                                                className={`w-full flex items-center justify-between p-4 rounded-3xl transition-all group ${selectedCourse?.id === course.id
                                                    ? 'bg-rose-50 border-2 border-rose-100'
                                                    : 'border-2 border-transparent hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4 text-left">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${selectedCourse?.id === course.id ? 'bg-white text-rose-600' : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                        {course.icon || '📚'}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-black ${selectedCourse?.id === course.id ? 'text-rose-900' : 'text-slate-700'}`}>
                                                            {course.title}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ID: {course.id}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className={`${selectedCourse?.id === course.id ? 'text-rose-400' : 'text-slate-300'} group-hover:translate-x-1 transition-transform`} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Restriction Controls */}
                    <div className="lg:col-span-8">
                        {selectedCourse ? (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden text-left">
                                <div className="p-10 border-b border-slate-50 bg-slate-50/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-3xl shadow-xl shadow-slate-200/50">
                                                {selectedCourse.icon || '📚'}
                                            </div>
                                            <div>
                                                <h2 className="text-3xl font-black text-slate-900 mb-1">{selectedCourse.title}</h2>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                                                        Curriculum Path: {selectedCourse.id}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                                                        Active Security
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-rose-600 hover:scale-105 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                            {saving ? 'Updating...' : 'Deploy Policies'}
                                        </button>
                                    </div>
                                </div>

                                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Copy Restriction */}
                                    <div className={`p-8 rounded-[2rem] border-2 transition-all cursor-pointer group ${restrictions.blockCopy ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50/30 border-transparent hover:border-slate-200'}`}
                                        onClick={() => toggleRestriction('blockCopy')}>
                                        <div className="flex items-start justify-between mb-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${restrictions.blockCopy ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <Copy size={24} />
                                            </div>
                                            <div className={`w-12 h-6 rounded-full relative transition-all ${restrictions.blockCopy ? 'bg-rose-600' : 'bg-slate-200'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${restrictions.blockCopy ? 'left-7' : 'left-1'}`}></div>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2">Block Code Export</h3>
                                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                            Prevent candidates from copying code snippets from the challenge instructions or editor.
                                        </p>
                                    </div>

                                    {/* Paste Restriction */}
                                    <div className={`p-8 rounded-[2rem] border-2 transition-all cursor-pointer group ${restrictions.blockPaste ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50/30 border-transparent hover:border-slate-200'}`}
                                        onClick={() => toggleRestriction('blockPaste')}>
                                        <div className="flex items-start justify-between mb-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${restrictions.blockPaste ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <Clipboard size={24} />
                                            </div>
                                            <div className={`w-12 h-6 rounded-full relative transition-all ${restrictions.blockPaste ? 'bg-rose-600' : 'bg-slate-200'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${restrictions.blockPaste ? 'left-7' : 'left-1'}`}></div>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2">Block External Imports</h3>
                                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                            Disable pasting code from external sources (StackOverflow, GPT) directly into the assessment editor.
                                        </p>
                                    </div>

                                    {/* Fullscreen Restriction */}
                                    <div className={`p-8 rounded-[2rem] border-2 transition-all cursor-pointer group ${restrictions.forceFullscreen ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50/30 border-transparent hover:border-slate-200'}`}
                                        onClick={() => toggleRestriction('forceFullscreen')}>
                                        <div className="flex items-start justify-between mb-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${restrictions.forceFullscreen ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <Maximize size={24} />
                                            </div>
                                            <div className={`w-12 h-6 rounded-full relative transition-all ${restrictions.forceFullscreen ? 'bg-rose-600' : 'bg-slate-200'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${restrictions.forceFullscreen ? 'left-7' : 'left-1'}`}></div>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2">Enforce Secure Container</h3>
                                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                            Force fullscreen and detect window-away/tab-switch threats. Auto-submits on violation limit.
                                        </p>
                                    </div>

                                    {/* Violation & Timer Settings */}
                                    <div className="p-8 rounded-[2rem] bg-slate-900 text-white space-y-6">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Violation Threshold</label>
                                                <span className="px-3 py-1 bg-rose-600 rounded-lg text-xs font-black">{restrictions.maxViolations} Strikes</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                value={restrictions.maxViolations}
                                                onChange={(e) => setRestrictions(prev => ({ ...prev, maxViolations: parseInt(e.target.value) }))}
                                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                                            />
                                        </div>

                                        <div className="pt-4 border-t border-slate-800">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-4">Fall-back Time Limit (MIN)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={restrictions.timeLimit}
                                                    onChange={(e) => setRestrictions(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                                                    className="w-full bg-slate-800 border-2 border-transparent focus:border-rose-600 rounded-2xl px-6 py-4 text-2xl font-black outline-none transition-all pr-16"
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 font-black text-xs">MIN</span>
                                            </div>
                                            <p className="mt-3 text-[10px] font-medium text-slate-500 italic">
                                                Note: Global Session timer will override this value during synced exams.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-slate-100 border-dashed">
                                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 mb-6">
                                    <BookOpen size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400">Select a course to manage policies</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #F1F5F9; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #E2E8F0; }
            ` }} />
        </SaaSLayout>
    );
};

export default RestrictionManagement;
