import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    History,
    CheckCircle,
    ArrowRight,
    Trophy,
    Trash2,
    Calendar,
    AlertTriangle,
    Eye,
    Download,
    ExternalLink,
    FileText,
    BookOpen,
    Clock
} from 'lucide-react';
import DataTable, { StatusBadge } from '../components/DataTable';
import SummaryAnalytics from '../components/SummaryAnalytics';

const FacultyHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteDate, setDeleteDate] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter and Sort State with persistence
    const [search, setSearch] = useState(() => localStorage.getItem('fh_search') || '');
    const [page, setPage] = useState(() => {
        const saved = localStorage.getItem('fh_page');
        return saved ? parseInt(saved, 10) : 1;
    });
    const [pageSize, setPageSize] = useState(() => {
        const saved = localStorage.getItem('fh_pageSize');
        return saved ? parseInt(saved, 10) : 25;
    });
    const [sortBy, setSortBy] = useState(() => localStorage.getItem('fh_sortBy') || 'submitted_at');
    const [sortDir, setSortDir] = useState(() => localStorage.getItem('fh_sortDir') || 'desc');
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('fh_filters');
        return saved ? JSON.parse(saved) : {};
    });

    // Save state to localStorage
    useEffect(() => {
        localStorage.setItem('fh_search', search);
        localStorage.setItem('fh_page', page.toString());
        localStorage.setItem('fh_pageSize', pageSize.toString());
        localStorage.setItem('fh_sortBy', sortBy);
        localStorage.setItem('fh_sortDir', sortDir);
        localStorage.setItem('fh_filters', JSON.stringify(filters));
    }, [search, page, pageSize, sortBy, sortDir, filters]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await api.get('/faculty/history');
            setHistory(res.data || []);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    // Advanced Filtering Logic
    const processedHistory = useMemo(() => {
        let result = [...history];

        // Global search
        const s = search.trim().toLowerCase();
        if (s) {
            result = result.filter(item => 
                (item.candidate_name || '').toLowerCase().includes(s) ||
                (item.course_title || '').toLowerCase().includes(s) ||
                (item.challenge_id || '').toLowerCase().includes(s)
            );
        }

        // Column filters
        Object.entries(filters).forEach(([key, filter]) => {
            if (!filter) return;
            if (filter.checked && filter.checked.length > 0) {
                result = result.filter(r => filter.checked.some(c => String(c) === String(r[key] || '')));
            } else if (filter.text) {
                const searchStr = filter.text.toLowerCase();
                result = result.filter(r => {
                    const val = String(r[key] || '').toLowerCase();
                    return val.includes(searchStr);
                });
            } else if (filter.startDate || filter.endDate) {
                result = result.filter(r => {
                    const dateVal = r[key] || r.submitted_at;
                    if (!dateVal) return false;
                    const rowDate = new Date(dateVal);
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
            }
        });

        // Sort
        if (sortBy) {
            result.sort((a, b) => {
                let valA = a[sortBy] || '';
                let valB = b[sortBy] || '';
                
                // Numeric sort for scores
                if (sortBy === 'manual_score') {
                    valA = Number(valA);
                    valB = Number(valB);
                }

                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [history, search, filters, sortBy, sortDir]);

    const paginatedHistory = useMemo(() => {
        const start = (page - 1) * pageSize;
        return processedHistory.slice(start, start + pageSize);
    }, [processedHistory, page, pageSize]);

    // Metrics for SummaryAnalytics
    const metrics = useMemo(() => ({
        total: processedHistory.length,
        passed: processedHistory.filter(r => (r.manual_status || r.final_status) === 'passed').length,
        failed: processedHistory.filter(r => (r.manual_status || r.final_status) === 'failed').length
    }), [processedHistory]);

    const handleExportCSV = () => {
        if (processedHistory.length === 0) return;
        
        const headers = ["Candidate", "Course", "Level", "Score", "Date", "Status"];
        const rows = processedHistory.map(r => [
            r.candidate_name || 'Anonymous',
            r.course_title,
            r.level,
            `${r.manual_score || 0}%`,
            r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : 'N/A',
            r.final_status || 'Completed'
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `evaluation_history_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkDelete = async () => {
        if (!deleteDate) {
            alert("Please select a cutoff date.");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete evaluations BEFORE ${deleteDate}? This action cannot be undone.`
        );

        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const res = await api.post('/faculty/bulk-delete', { beforeDate: deleteDate });
            alert(res.data.message || "Bulk delete completed.");
            setDeleteDate('');
            fetchHistory();
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert(error.response?.data?.error || "Failed to perform bulk delete.");
        } finally {
            setIsDeleting(false);
        }
    };

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
                        <p className="font-bold text-slate-900 leading-tight">{row.candidate_name || 'Anonymous'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <BookOpen size={10} className="text-slate-500" />
                            <span className="font-bold">{row.course_title}</span>
                            <span className="bg-slate-100 px-1 rounded text-[9px] uppercase border border-slate-200">Level {row.level}</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'final_status',
            label: 'Status',
            sortable: true,
            filterable: true,
            filterOptions: [
                { label: 'PASSED', value: 'passed' },
                { label: 'FAILED', value: 'failed' }
            ],
            renderCell: (val, row) => (
                <div className="flex justify-center">
                    <StatusBadge value={row.final_status || 'passed'} />
                </div>
            )
        },
        {
            key: 'manual_score',
            label: 'Final Score',
            sortable: true,
            filterable: false,
            renderCell: (val, row) => (
                <div className="text-center">
                    <div className="flex flex-col items-center">
                        <span className="text-blue-600 font-bold text-base">{row.manual_score || 0}%</span>
                        <div className="flex gap-1 mt-1">
                            <div className="w-1 h-1 rounded-full bg-slate-300" title={`Q: ${row.code_quality_score}`} />
                            <div className="w-1 h-1 rounded-full bg-slate-300" title={`R: ${row.requirements_score}`} />
                            <div className="w-1 h-1 rounded-full bg-slate-300" title={`O: ${row.expected_output_score}`} />
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'submitted_at',
            label: 'Date',
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
            filterable: false,
            renderCell: (_, row) => {
                if (!row.submitted_at) return <span className="text-xs text-slate-400 font-medium">—</span>;
                const d = new Date(row.submitted_at);
                return <span className="text-xs text-slate-500 font-medium">
                    {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>;
            }
        },
        {
            key: 'action',
            label: 'Action',
            sortable: false,
            filterable: false,
            renderCell: (val, row) => (
                <div className="text-right flex justify-end">
                    <button
                        onClick={() => navigate(`/faculty/evaluate/${row.id}`)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors bg-transparent hover:bg-slate-100 rounded-md"
                        title="View Submission"
                    >
                        <ExternalLink size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <SaaSLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight text-left">Evaluation History</h1>
                        <p className="text-slate-500 mt-1 text-left text-sm font-medium">Review and manage your previously graded submissions.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportCSV}
                            disabled={processedHistory.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                        
                        {/* Storage Management / Bulk Delete */}
                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-md shadow-sm">
                            <div className="hidden sm:flex items-center gap-1.5 text-amber-600 mr-2">
                                <Trash2 size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Cleanup</span>
                            </div>
                            <input
                                type="date"
                                value={deleteDate}
                                onChange={(e) => setDeleteDate(e.target.value)}
                                className="px-2 py-1 bg-white border border-amber-200 rounded text-[10px] font-bold text-slate-700 outline-none w-28"
                            />
                            <button
                                onClick={handleBulkDelete}
                                disabled={!deleteDate || isDeleting}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${!deleteDate || isDeleting
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : 'bg-amber-600 text-white hover:bg-amber-700'
                                }`}
                            >
                                {isDeleting ? '...' : 'Clear'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metrics */}
                {!loading && (
                    <div className="mb-6">
                        <SummaryAnalytics metrics={metrics} type="results" />
                    </div>
                )}

                {/* History Table */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <DataTable
                        columns={columns}
                        data={paginatedHistory}
                        filterData={history}
                        loading={loading}
                        totalItems={processedHistory.length}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={(col, dir) => { setSortBy(col); setSortDir(dir); }}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onSearch={setSearch}
                        searchValue={search}
                        emptyMessage="No evaluation history found."
                    />
                </div>
            </div>
        </SaaSLayout>
    );
};

export default FacultyHistory;
