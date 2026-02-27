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
    RefreshCw,
    CheckCircle
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
            <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-800 flex flex-col items-center">
                <div className="w-full max-w-7xl space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 shadow-sm">
                                <Shield size={12} />
                                <span>Security Management</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                                Exam Restrictions
                            </h1>
                            <p className="text-slate-500 font-medium mt-2 max-w-2xl text-sm md:text-base">
                                Configure global anti-cheat policies and structural integrity blocks on a per-course basis. Changes take effect on the next test session initialization.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Column 1: Course Selection */}
                        <div className="lg:col-span-4 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[700px] overflow-hidden transition-all hover:shadow-lg group">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                                        <BookOpen size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Target Course</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Scope</p>
                                    </div>
                                </div>
                                {selectedCourse && <CheckCircle className="text-emerald-500" size={24} />}
                            </div>

                            <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search courses..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold placeholder:font-medium placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                                            <RefreshCw className="animate-spin text-blue-500" size={28} />
                                            <p className="text-xs font-bold text-slate-400">Loading Configuration...</p>
                                        </div>
                                    ) : (
                                        <>
                                            {filteredCourses.map(course => (
                                                <button
                                                    key={course.id}
                                                    onClick={() => handleSelectCourse(course)}
                                                    className={`w-full p-4 rounded-2xl text-left border transition-all duration-200 ${selectedCourse?.id === course.id
                                                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-600 ring-offset-2'
                                                        : 'bg-white border-slate-100 hover:border-violet-200 hover:bg-violet-50 text-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${selectedCourse?.id === course.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            {course.icon || '📚'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-sm truncate">{course.title}</p>
                                                            <p className={`text-[11px] mt-0.5 truncate font-medium ${selectedCourse?.id === course.id ? 'text-violet-200' : 'text-slate-400'
                                                                }`}>
                                                                ID: {course.id.split('-').shift() || course.id}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredCourses.length === 0 && (
                                                <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                    <p className="text-sm font-bold text-slate-400">No courses match search.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Configuration */}
                        <div className="lg:col-span-8">
                            {selectedCourse ? (
                                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[700px] transition-all hover:shadow-lg relative overflow-hidden">
                                    {/* Action Header */}
                                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm border border-slate-100">
                                                {selectedCourse.icon || '🛡️'}
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-black text-slate-900">{selectedCourse.title}</h2>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                                        Active Config
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Environment Rules
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className={`relative z-10 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${saving
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 hover:-translate-y-0.5 active:translate-y-0'
                                                }`}
                                        >
                                            {saving ? (
                                                <>
                                                    <RefreshCw size={16} className="animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16} />
                                                    Apply Policies
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Scrollable Form */}
                                    <div className="p-6 lg:p-10 flex-1 overflow-y-auto custom-scrollbar bg-white relative z-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                            {/* Block Copy */}
                                            <div
                                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${restrictions.blockCopy
                                                    ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                                                    : 'bg-white border-slate-100 hover:border-blue-100'
                                                    }`}
                                                onClick={() => toggleRestriction('blockCopy')}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${restrictions.blockCopy ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        <Copy size={20} />
                                                    </div>
                                                    {/* Toggle Switch */}
                                                    <div className={`w-11 h-6 rounded-full relative transition-all ${restrictions.blockCopy ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${restrictions.blockCopy ? 'left-[22px]' : 'left-1'}`}></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900 mb-1">Block Export</h3>
                                                    <p className="text-slate-500 text-xs font-bold leading-relaxed">
                                                        Prevent code copying directly from the editor module.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Block Paste */}
                                            <div
                                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${restrictions.blockPaste
                                                    ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                                                    : 'bg-white border-slate-100 hover:border-blue-100'
                                                    }`}
                                                onClick={() => toggleRestriction('blockPaste')}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${restrictions.blockPaste ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        <Clipboard size={20} />
                                                    </div>
                                                    <div className={`w-11 h-6 rounded-full relative transition-all ${restrictions.blockPaste ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${restrictions.blockPaste ? 'left-[22px]' : 'left-1'}`}></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900 mb-1">Block Imports</h3>
                                                    <p className="text-slate-500 text-xs font-bold leading-relaxed">
                                                        Stop candidates from pasting external code into the assessment.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Advanced Tracking */}
                                            <div
                                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between md:col-span-2 ${restrictions.forceFullscreen
                                                    ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                                                    : 'bg-white border-slate-100 hover:border-indigo-100'
                                                    }`}
                                                onClick={() => toggleRestriction('forceFullscreen')}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${restrictions.forceFullscreen ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        <Maximize size={20} />
                                                    </div>
                                                    <div className={`w-11 h-6 rounded-full relative transition-all ${restrictions.forceFullscreen ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${restrictions.forceFullscreen ? 'left-[22px]' : 'left-1'}`}></div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
                                                    <div className="max-w-md">
                                                        <h3 className="text-base font-black text-slate-900 mb-1">Strict Environment Isolation</h3>
                                                        <p className="text-slate-500 text-xs font-bold leading-relaxed">
                                                            Forces fullscreen mode. Automatically tracks application switching, browser tab changes, dev tools access, and mouse exits. Submits exam if limits exceed threshold.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quantitative Configurations */}
                                        <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                            {/* Decorative glows */}
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px] pointer-events-none" />
                                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

                                            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Violations Config */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Violation Strike Limit</label>
                                                        <span className="px-2.5 py-1 bg-white/10 rounded-md text-white text-xs font-black">{restrictions.maxViolations} Max</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="10"
                                                        value={restrictions.maxViolations}
                                                        onChange={(e) => setRestrictions(prev => ({ ...prev, maxViolations: parseInt(e.target.value) }))}
                                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                    <p className="mt-3 text-[10px] font-bold text-slate-500">Number of allowed infractions before auto-submission.</p>
                                                </div>

                                                {/* Fallback Timer Config */}
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Base Fallback Timer</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={restrictions.timeLimit}
                                                            onChange={(e) => setRestrictions(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                                                            className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-lg font-black outline-none transition-all pr-16"
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs uppercase">Mins</span>
                                                    </div>
                                                    <p className="mt-2 text-[10px] font-bold text-slate-500">Overrides unless a Global Test Session is active.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[700px] flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-200 border-dashed shadow-sm">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-6">
                                        <BookOpen size={28} />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-400">No Course Selected</h3>
                                    <p className="text-slate-400 text-sm font-bold mt-1">Select a targeting vector to manipulate security properties.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default RestrictionManagement;
