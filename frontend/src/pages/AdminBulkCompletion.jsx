import React, { useState, useEffect } from 'react';
import {
    Users,
    ChevronRight,
    Upload,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Database,
    Search,
    BookOpen,
    ArrowRight
} from 'lucide-react';
import SaaSLayout from '../components/SaaSLayout';
import { getCourses, bulkCompleteLevel } from '../services/api';
import ToastContainer from '../components/Toast';

const AdminBulkCompletion = () => {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [level, setLevel] = useState(1);
    const [identifiers, setIdentifiers] = useState('');
    const [identifierType, setIdentifierType] = useState('email');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState(null);
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const resp = await getCourses();
            setCourses(resp.data);
            if (resp.data.length > 0) setSelectedCourse(resp.data[0].id);
        } catch (err) {
            addToast('Failed to load courses', 'error');
        }
    };

    const handleBulkComplete = async () => {
        if (!identifiers.trim()) {
            addToast('Please enter at least one email or roll number', 'warning');
            return;
        }

        const identifierList = identifiers.split('\n').map(i => i.trim()).filter(i => i);

        setIsProcessing(true);
        setResults(null);
        try {
            const resp = await bulkCompleteLevel({
                identifiers: identifierList,
                courseId: selectedCourse,
                level: parseInt(level),
                type: identifierType
            });
            setResults(resp.data.results);
            addToast('Bulk processing complete', 'success');
        } catch (err) {
            addToast(err.response?.data?.error || 'Failed to process bulk completion', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const lines = content.split('\n').map(l => l.trim()).filter(l => l);
            // Skip header if it looks like one
            if (lines[0]?.toLowerCase().includes('email') || lines[0]?.toLowerCase().includes('roll')) {
                lines.shift();
            }
            setIdentifiers(lines.join('\n'));
        };
        reader.readAsText(file);
    };

    return (
        <SaaSLayout>
            <div className="min-h-screen bg-white -m-8 p-12 font-sans antialiased text-slate-900 overflow-x-hidden">
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                {/* Header */}
                <div className="mx-auto mb-10 pb-10 border-b-2 border-slate-100 flex items-end justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                                <Database size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                                Bulk Management System
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">Level Bulk Operations</h1>
                        <p className="text-slate-500 font-bold text-lg mt-4 max-w-2xl">Unlock course progression for multiple students simultaneously with enterprise-grade precision.</p>
                    </div>
                </div>

                <div className="mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16">
                    {/* Left: Input Form */}
                    <div className="lg:col-span-5 space-y-12">
                        <section className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
                                <BookOpen size={16} /> 01. Define Target Context
                            </h3>
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 px-1">Target Course</label>
                                    <select
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        {courses.map(c => (
                                            <option key={c.id} value={c.id}>{c.title}</option>
                                        ))}
                                    </select>
                                </div>

                            </div>
                        </section>

                        <section className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-2xl shadow-slate-100">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
                                <Users size={16} /> 02. Student Identification
                            </h3>
                            <div className="space-y-6">
                                <div className="flex gap-4 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <button
                                        onClick={() => setIdentifierType('email')}
                                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${identifierType === 'email' ? 'bg-white text-blue-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Email Addresses
                                    </button>
                                    <button
                                        onClick={() => setIdentifierType('rollNo')}
                                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${identifierType === 'rollNo' ? 'bg-white text-blue-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Roll Numbers
                                    </button>
                                </div>
                                <div className="relative group">
                                    <textarea
                                        rows="12"
                                        placeholder={`Entry list for ${identifierType === 'email' ? 'emails' : 'roll numbers'} (one per line)...`}
                                        value={identifiers}
                                        onChange={(e) => setIdentifiers(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 text-lg font-bold placeholder:text-slate-300 focus:ring-8 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-mono min-h-[350px] custom-scrollbar"
                                    ></textarea>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                                    <label className="w-full sm:w-auto flex-1 cursor-pointer group">
                                        <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                                        <div className="flex items-center justify-center gap-3 py-5 px-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 group-hover:border-blue-300 group-hover:text-blue-500 transition-all bg-slate-50/50 group-hover:bg-blue-50/30">
                                            <Upload size={20} />
                                            <span className="text-xs font-black uppercase tracking-widest">Import CSV / Text</span>
                                        </div>
                                    </label>
                                    <button
                                        onClick={handleBulkComplete}
                                        disabled={isProcessing}
                                        className="w-full sm:w-auto px-10 py-3 bg-blue-600 text-white rounded-lg font-black text-sm transition-all hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? 'Synchronizing...' : 'Execute Bulk Unlock'}
                                        {!isProcessing && <ArrowRight size={18} />}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right: Results */}
                    <div className="lg:col-span-7">
                        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-slate-900/40 h-full min-h-[600px] border border-white/5 relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

                            {!results && !isProcessing && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 relative z-10">
                                    <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center mb-8 shadow-inner">
                                        <Search size={48} className="text-slate-600" />
                                    </div>
                                    <h4 className="text-slate-400 font-black text-sm uppercase tracking-[0.3em]">System Standing By</h4>
                                    <p className="text-slate-500 text-base mt-4 max-w-sm font-bold">Input student signatures and target vector to initialize synchronization.</p>
                                </div>
                            )}

                            {isProcessing && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 relative z-10">
                                    <div className="relative mb-12">
                                        <div className="w-24 h-24 border-8 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Database size={32} className="text-blue-400 animate-pulse" />
                                        </div>
                                    </div>
                                    <h4 className="text-blue-400 font-black text-sm uppercase tracking-[0.3em]">Processing Batch</h4>
                                    <p className="text-slate-400 text-base mt-4 font-bold">Updating blockchain records and unlocking progression milestones...</p>
                                </div>
                            )}

                            {results && (
                                <div className="flex-1 flex flex-col relative z-10">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-8 mb-8">
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-3">
                                                Operational Manifest
                                            </h3>
                                            <p className="text-slate-400 text-xs mt-2 font-bold tracking-widest pl-0">BATCH SERIAL: {Date.now().toString(36).toUpperCase()}</p>
                                        </div>
                                        <div className="flex gap-6">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Success</p>
                                                <p className="text-2xl font-black text-white">{results.success.length}</p>
                                            </div>
                                            <div className="text-right border-l border-white/10 pl-6">
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Failed</p>
                                                <p className="text-2xl font-black text-white">{results.failed.length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto pr-4 custom-scrollbar-dark pb-8">
                                        {results.success.map((res, i) => (
                                            <div key={i} className="flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group scale-100 hover:scale-[1.02] duration-300">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
                                                        <CheckCircle2 size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-white group-hover:text-emerald-400 transition-colors">{res.identifier}</p>
                                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{res.username}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-3 py-1.5 bg-emerald-500/10 rounded-lg">Verified</span>
                                                </div>
                                            </div>
                                        ))}

                                        {results.failed.map((res, i) => (
                                            <div key={i} className="flex items-center justify-between p-5 bg-rose-500/5 hover:bg-rose-500/10 rounded-2xl border border-rose-500/20 transition-all group scale-100 hover:scale-[1.02] duration-300">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform shadow-lg shadow-rose-500/10">
                                                        <XCircle size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-white group-hover:text-rose-400 transition-colors">{res.identifier}</p>
                                                        <p className="text-[10px] text-rose-500/80 font-black uppercase tracking-widest mt-1">{res.reason}</p>
                                                    </div>
                                                </div>
                                                <AlertCircle size={24} className="text-rose-600/40" />
                                            </div>
                                        ))}
                                    </div>

                                    {results.success.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                                            <button
                                                onClick={() => setResults(null)}
                                                className="w-full sm:w-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-black uppercase tracking-widest transition-all border border-blue-100 flex items-center justify-center gap-2"
                                            >
                                                Clear Manifest
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default AdminBulkCompletion;
