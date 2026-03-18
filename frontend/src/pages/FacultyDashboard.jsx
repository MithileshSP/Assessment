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
    Clock,
    LayoutList,
    Trophy
} from 'lucide-react';
import DataTable, { StatusBadge } from '../components/DataTable';

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

    // Unified Filters and Pagination State from LocalStorage
    const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('fac_searchQuery') || '');
    const [currentPage, setCurrentPage] = useState(() => {
        const saved = localStorage.getItem('fac_currentPage');
        return saved ? parseInt(saved, 10) : 1;
    });
    const [pageSize, setPageSize] = useState(() => {
        const saved = localStorage.getItem('fac_pageSize');
        return saved ? parseInt(saved, 10) : 25;
    });
    const [sortBy, setSortBy] = useState(() => localStorage.getItem('fac_sortBy') || 'submitted_at');
    const [sortDir, setSortDir] = useState(() => localStorage.getItem('fac_sortDir') || 'desc');
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('fac_filters');
        return saved ? JSON.parse(saved) : {};
    });

    // Sync to LocalStorage
    useEffect(() => {
        localStorage.setItem('fac_searchQuery', searchQuery);
        localStorage.setItem('fac_currentPage', currentPage.toString());
        localStorage.setItem('fac_pageSize', pageSize.toString());
        localStorage.setItem('fac_sortBy', sortBy);
        localStorage.setItem('fac_sortDir', sortDir);
        localStorage.setItem('fac_filters', JSON.stringify(filters));
    }, [searchQuery, currentPage, pageSize, sortBy, sortDir, filters]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters]);

    const uniqueCourses = useMemo(() => {
        return [...new Set(queue.map(item => item.course_title))].filter(Boolean);
    }, [queue]);

    const uniqueLevels = useMemo(() => {
        return [...new Set(queue.map(item => item.level))].filter(Boolean);
    }, [queue]);

    const filteredQueue = useMemo(() => {
        let processed = queue.filter(item => {
            const matchSearch = searchQuery.trim() === '' ||
                (item.candidate_name || 'Anonymous User').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.course_title || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchSearch;
        });

        // Apply advanced column filters
        Object.entries(filters).forEach(([key, filter]) => {
            if (!filter) return;
            if (filter.checked) {
                processed = processed.filter(r => {
                    const rowVal = String(r[key] || '');
                    return filter.checked.some(c => String(c) === rowVal);
                });
            } else if (filter.text) {
                const searchStr = filter.text.toLowerCase();
                processed = processed.filter(r => {
                    const val = String(r[key] || '').toLowerCase();
                    if (filter.textMode === 'equals') return val === searchStr;
                    if (filter.textMode === 'starts') return val.startsWith(searchStr);
                    return val.includes(searchStr);
                });
            } else if (filter.startDate || filter.endDate) {
                processed = processed.filter(r => {
                    if (!r[key] && !r.submitted_at) return false;
                    const rowDate = new Date(r[key] || r.submitted_at);
                    if (isNaN(rowDate)) return false;

                    if (filter.startDate) {
                        const sd = new Date(filter.startDate);
                        sd.setHours(0, 0, 0, 0);
                        if (rowDate < sd) return false;
                    }
                    if (filter.endDate) {
                        const ed = new Date(filter.endDate);
                        ed.setHours(23, 59, 59, 999);
                        if (rowDate > ed) return false;
                    }
                    return true;
                });
            } else if (filter.startTime || filter.endTime) {
                processed = processed.filter(r => {
                    if (!r.submitted_at) return false;
                    const rowDate = new Date(r.submitted_at);
                    const rowTime = rowDate.getHours().toString().padStart(2, '0') + ':' + rowDate.getMinutes().toString().padStart(2, '0');

                    if (filter.startTime && rowTime < filter.startTime) return false;
                    if (filter.endTime && rowTime > filter.endTime) return false;
                    return true;
                });
            }
        });

        return processed;
    }, [queue, searchQuery, filters]);

    const totalPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
    
    // Ensure currentPage doesn't exceed totalPages (e.g., if a filter shrinks the visible results)
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const startIndex = (Math.min(currentPage, totalPages) - 1) * pageSize;
    // const paginatedQueue = filteredQueue.slice(startIndex, startIndex + rowsPerPage); // We'll let DataTable handle pagination if we pass full data, or we slice it here. 
    // Actually, looking at AdminResults.jsx, it passes paginatedResults to DataTable but also passes totalItems.
    // DataTable expects the data it receives to be the current page's data if totalItems is provided.
    
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    // Define table columns
    const columns = [
        {
            key: 'candidate_name',
            label: 'Candidate / Test',
            sortable: true,
            filterable: true,
            renderCell: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase border border-slate-200">
                        {(row.candidate_name || 'A').charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 leading-tight text-xs">{row.candidate_name || 'Anonymous'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <FileText size={10} className="text-slate-500" />
                            <span className="font-bold">{row.course_title}</span>
                            <span className="bg-slate-100 px-1 rounded text-[9px] uppercase border border-slate-200">L{row.level}</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'submitted_at',
            label: 'Submitted Date',
            sortable: true,
            filterable: true,
            filterType: 'date-range',
            renderCell: (val, row) => (
                <div className="text-slate-600 font-medium text-xs">
                    {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                </div>
            )
        },
        {
            key: 'submitted_at_time',
            label: 'Time',
            sortable: false,
            filterable: true,
            filterType: 'time-range',
            renderCell: (_, row) => {
                if (!row.submitted_at) return <span className="text-xs text-slate-400 font-medium">—</span>;
                const d = new Date(row.submitted_at);
                return <span className="text-xs text-slate-500 font-medium">
                    {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>;
            }
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            filterable: true,
            renderCell: (val, row) => (
                <div className="flex justify-start">
                    <StatusBadge value={row.status || 'pending'} />
                </div>
            )
        },
        {
            key: 'action',
            label: 'Action',
            sortable: false,
            filterable: false,
            renderCell: (val, row) => (
                <div className="text-right">
                    <button
                        onClick={() => navigate(`/faculty/evaluate/${row.id}`)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                    >
                        Evaluate
                        <ArrowRight size={12} />
                    </button>
                </div>
            )
        }
    ];

    // Apply Sorting
    const sortedQueue = useMemo(() => {
        if (!sortBy) return filteredQueue;
        return [...filteredQueue].sort((a, b) => {
            const valA = a[sortBy] || '';
            const valB = b[sortBy] || '';
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredQueue, sortBy, sortDir]);

    const paginatedQueue = sortedQueue.slice(startIndex, startIndex + pageSize);

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
                <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <DataTable
                        columns={columns}
                        data={paginatedQueue}
                        filterData={queue}
                        loading={loading}
                        totalItems={filteredQueue.length}
                        page={currentPage}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                        }}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={(col, dir) => { setSortBy(col); setSortDir(dir); }}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onSearch={setSearchQuery}
                        searchValue={searchQuery}
                        emptyMessage="No pending evaluations found."
                    />
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
