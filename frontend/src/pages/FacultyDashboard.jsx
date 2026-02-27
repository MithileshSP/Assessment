import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    FileText,
    CheckCircle,
    ArrowRight,
    ClipboardList,
    Download,
    Shuffle,
    X,
    Search,
    Clock
} from 'lucide-react';

const FacultyDashboard = () => {
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({
        questionsAdded: 0,
        evaluated: 0,
        pending: 0
    });
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [reallocModal, setReallocModal] = useState(null); // submission id
    const [availableFaculty, setAvailableFaculty] = useState([]);
    const [facSearch, setFacSearch] = useState('');
    const [reallocLoading, setReallocLoading] = useState(false);
    const navigate = useNavigate();

    // Filters and Pagination State
    const [searchQuery, setSearchQuery] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 5;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, courseFilter, levelFilter]);

    const uniqueCourses = useMemo(() => {
        return [...new Set(queue.map(item => item.course_title))].filter(Boolean);
    }, [queue]);

    const uniqueLevels = useMemo(() => {
        return [...new Set(queue.map(item => item.level))].filter(Boolean);
    }, [queue]);

    const filteredQueue = useMemo(() => {
        return queue.filter(item => {
            const matchSearch = (item.candidate_name || 'Anonymous User').toLowerCase().includes(searchQuery.toLowerCase());
            const matchCourse = courseFilter ? item.course_title === courseFilter : true;
            const matchLevel = levelFilter ? item.level?.toString() === levelFilter : true;
            return matchSearch && matchCourse && matchLevel;
        });
    }, [queue, searchQuery, courseFilter, levelFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredQueue.length / rowsPerPage));
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedQueue = filteredQueue.slice(startIndex, startIndex + rowsPerPage);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [queueRes, statsRes] = await Promise.all([
                api.get('/faculty/queue'),
                api.get('/faculty/stats')
            ]);
            setQueue(queueRes.data);
            setStats(statsRes.data);
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportBackup = async () => {
        try {
            const response = await api.get('/faculty/export-backup', {
                responseType: 'blob'
            });

            // If response is JSON (error or no data)
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                const text = await response.data.text();
                const json = JSON.parse(text);
                alert(json.message || 'Export failed');
                return;
            }

            // Download the CSV file
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `submissions_backup_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Failed to export backup', 'error');
        }
    };

    const openReallocModal = async (subId) => {
        setReallocModal(subId);
        setFacSearch('');
        try {
            const res = await api.get('/faculty/available-faculty');
            setAvailableFaculty(res.data || []);
        } catch (e) {
            showToast('Failed to load available faculty', 'error');
            setReallocModal(null);
        }
    };

    const handleReallocate = async (targetFacultyId) => {
        if (!reallocModal) return;
        setReallocLoading(true);
        try {
            await api.post('/faculty/reallocate', {
                submissionId: reallocModal,
                targetFacultyId,
                reason: 'Faculty-initiated reallocation'
            });
            showToast('Submission reallocated successfully');
            setReallocModal(null);
            fetchData();
        } catch (err) {
            showToast(err.response?.data?.error || 'Reallocation failed', 'error');
        } finally {
            setReallocLoading(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Faculty Workspace</h1>
                        <p className="text-lg font-medium text-slate-500 mt-1 text-left">Review and grade pending student submissions.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleExportBackup}
                            className="bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <Download size={16} /> Export Backup
                        </button>
                        <div className="bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">{stats.pending} Tasks Pending</span>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Evaluation Queue</p>
                            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                                <ClipboardList size={18} />
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <p className="text-3xl font-black text-slate-900">{stats.pending}</p>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase tracking-wide">Pending</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Evaluated Units</p>
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                                <CheckCircle size={18} />
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <p className="text-3xl font-black text-slate-900">{stats.evaluated}</p>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 uppercase tracking-wide">Completed</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Questions Added</p>
                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                                <FileText size={18} />
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <p className="text-3xl font-black text-slate-900">{stats.questionsAdded}</p>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 uppercase tracking-wide">Contribution</span>
                        </div>
                    </div>
                </div>

                {/* Submissions Table */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 shrink-0">Pending Evaluations</h3>

                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
                            <div className="relative w-full sm:w-56">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search candidate..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                                />
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select
                                    value={courseFilter}
                                    onChange={(e) => setCourseFilter(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-600 cursor-pointer"
                                >
                                    <option value="">All Courses</option>
                                    {uniqueCourses.map(course => (
                                        <option key={course} value={course}>{course}</option>
                                    ))}
                                </select>
                                <select
                                    value={levelFilter}
                                    onChange={(e) => setLevelFilter(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-600 cursor-pointer"
                                >
                                    <option value="">All Levels</option>
                                    {uniqueLevels.map(level => (
                                        <option key={level} value={level.toString()}>Level {level}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3">Candidate</th>
                                    <th className="px-5 py-3">Course & Level</th>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3">Time</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500 text-xs font-medium">Loading queue...</td></tr>
                                ) : filteredQueue.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-5 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                                    <CheckCircle size={20} />
                                                </div>
                                                <p className="text-slate-500 font-medium text-xs">
                                                    {queue.length === 0 ? "No pending evaluations" : "No evaluations match your filters"}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedQueue.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px] uppercase border border-slate-200">
                                                        {item.candidate_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-xs">{item.candidate_name || 'Anonymous User'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-600 font-medium text-xs">{item.course_title}</span>
                                                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] border border-blue-100">L{item.level}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-slate-500 font-medium text-xs">
                                                {new Date(item.submitted_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-3 text-slate-500 font-medium text-xs">
                                                {new Date(item.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => navigate(`/faculty/evaluate/${item.id}`)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                                    >
                                                        Evaluate
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {!loading && filteredQueue.length > 0 && (
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                                Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredQueue.length)} of {filteredQueue.length} entries
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Re-allocate Faculty Picker Modal */}
                {reallocModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                        <div className="bg-white rounded-md shadow-xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-sm font-bold text-slate-900">Re-allocate Submission</h3>
                                <button onClick={() => setReallocModal(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 border-b border-slate-100">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text" value={facSearch} onChange={e => setFacSearch(e.target.value)}
                                        placeholder="Search faculty..."
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                {availableFaculty
                                    .filter(f => !facSearch.trim() || (f.full_name || '').toLowerCase().includes(facSearch.toLowerCase()))
                                    .map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => handleReallocate(f.id)}
                                            disabled={reallocLoading || f.current_load >= f.max_capacity}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                                        >
                                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center border border-slate-200 group-hover:border-slate-300">
                                                <span className="text-xs font-bold text-slate-600">{(f.full_name || '?')[0].toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{f.full_name}</p>
                                                <p className="text-[10px] text-slate-400">{f.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-600">{f.current_load ?? 0}/{f.max_capacity ?? 10}</p>
                                                <p className="text-[9px] text-slate-400 uppercase">Load</p>
                                            </div>
                                        </button>
                                    ))}
                                {availableFaculty.length === 0 && (
                                    <p className="text-center py-6 text-xs text-slate-400">No available faculty</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-md shadow-lg text-xs font-bold text-white flex items-center gap-2
                    ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}
                >
                    {toast.type === 'error' ? <X size={14} /> : <CheckCircle size={14} />}
                    {toast.msg}
                </div>
            )}
        </SaaSLayout >
    );
};

export default FacultyDashboard;
