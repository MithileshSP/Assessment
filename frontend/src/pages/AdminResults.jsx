import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import { Trophy, Search, Filter, Download, ExternalLink, User, BookOpen, Calendar, Trash2 } from 'lucide-react';
import DataTable from '../components/DataTable';

export default function AdminResults() {
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // DataTable state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sortBy, setSortBy] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const [filters, setFilters] = useState({});

    useEffect(() => {
        loadResults();
    }, []);

    const loadResults = async () => {
        try {
            const response = await api.get('/admin/results');
            setResults(response.data);
        } catch (error) {
            console.error('Failed to load results:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            // Build query params for date filtering
            const params = new URLSearchParams();
            if (fromDate) params.append('fromDate', fromDate);
            if (toDate) params.append('toDate', toDate);

            const response = await api.get(`/admin/results/export?${params.toString()}`, {
                responseType: 'blob'
            });

            // Check if response is JSON (no new exports)
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                const text = await response.data.text();
                const json = JSON.parse(text);
                alert(json.message || 'No new submissions to export');
                return;
            }

            // Download the CSV file
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `results_export_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // Reload results to update any UI state if needed
            loadResults();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export CSV. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (!fromDate && !toDate) {
            alert('Please select a date range (From/To) to use bulk delete.');
            return;
        }

        const confirmMsg = `Are you sure you want to delete visible results for the selected date range?\n\nDate Range: ${fromDate || 'Beginning'} to ${toDate || 'Now'}\n\nTHIS ACTION CANNOT BE UNDONE.`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        // Double confirmation for safety
        if (!window.confirm("Verify: This will permanently remove submissions, scores, and faculty assignments for the selected period. Confirm deletion?")) {
            return;
        }

        try {
            // Build query params
            const params = new URLSearchParams();
            if (fromDate) params.append('fromDate', fromDate);
            if (toDate) params.append('toDate', toDate);

            setLoading(true);
            const response = await api.delete(`/admin/results/bulk?${params.toString()}`);

            alert(response.data.message || 'Bulk delete completed.');
            loadResults(); // Refresh table
        } catch (error) {
            console.error('Bulk delete failed:', error);
            alert(error.response?.data?.error || 'Failed to perform bulk delete.');
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering, sorting, and pagination
    let processed = results.filter(r =>
        r.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.course_title?.toLowerCase().includes(search.toLowerCase())
    );

    // Apply advanced column filters
    Object.entries(filters).forEach(([key, filter]) => {
        if (!filter) return;
        if (filter.checked) {
            processed = processed.filter(r => filter.checked.includes(r[key]));
        } else if (filter.text) {
            const searchStr = filter.text.toLowerCase();
            processed = processed.filter(r => {
                const val = String(r[key] || '').toLowerCase();
                if (filter.textMode === 'equals') return val === searchStr;
                if (filter.textMode === 'starts') return val.startsWith(searchStr);
                return val.includes(searchStr);
            });
        }
    });

    // Sort
    if (sortBy) {
        processed.sort((a, b) => {
            const valA = a[sortBy] || '';
            const valB = b[sortBy] || '';
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const totalItems = processed.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = processed.slice(startIndex, startIndex + pageSize);

    // Reset to page 1 if filtered results are less than current page offset
    useEffect(() => {
        if (totalItems > 0 && startIndex >= totalItems) {
            setPage(1);
        }
    }, [totalItems, startIndex]);

    // Define table columns
    const columns = [
        {
            key: 'candidate_name',
            label: 'Candidate / Test',
            sortable: true,
            filterable: true,
            renderCell: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                        <User size={18} />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900">{row.candidate_name || 'Anonymous'}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <BookOpen size={10} className="text-blue-500" />
                            <span className="font-bold">{row.course_title}</span>
                            <span className="bg-slate-100 px-1.5 rounded text-[9px] uppercase">Level {row.level}</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'final_status',
            label: 'Final Status',
            sortable: true,
            filterable: true,
            renderCell: (val, row) => (
                <div className="flex justify-center">
                    <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider border ${row.final_status === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        row.final_status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                        {row.final_status || 'PENDING'}
                    </span>
                </div>
            )
        },
        {
            key: 'auto_score',
            label: 'Auto Score',
            sortable: true,
            filterable: false,
            renderCell: (val, row) => (
                <div className="text-center font-mono font-bold text-slate-600">
                    {row.auto_score !== null ? `${row.auto_score}%` : '-'}
                </div>
            )
        },
        {
            key: 'manual_score',
            label: 'Manual Score',
            sortable: true,
            filterable: false,
            renderCell: (val, row) => (
                <div className="text-center">
                    {row.manual_score !== null ? (
                        <div className="flex flex-col items-center">
                            <span className="text-blue-600 font-bold text-base">{row.manual_score}</span>
                            <div className="flex gap-1 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" title={`Q: ${row.code_quality_score}`} />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" title={`R: ${row.requirements_score}`} />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" title={`O: ${row.expected_output_score}`} />
                            </div>
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Awaiting</span>
                    )}
                </div>
            )
        },
        {
            key: 'evaluator_name',
            label: 'Evaluator',
            sortable: true,
            filterable: true,
            renderCell: (val, row) => (
                <div className="font-medium text-slate-500 text-xs text-left">
                    {row.evaluator_name ? (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100">
                                {row.evaluator_name.charAt(0).toUpperCase()}
                            </div>
                            {row.evaluator_name}
                        </div>
                    ) : '-'}
                </div>
            )
        },
        {
            key: 'action',
            label: 'Action',
            sortable: false,
            filterable: false,
            renderCell: (val, row) => (
                <div className="text-right flex justify-end">
                    <button
                        onClick={() => navigate(`/admin/submission/${row.id}`)}
                        className="p-2 text-slate-300 hover:text-blue-600 transition-colors bg-transparent hover:bg-blue-50 rounded-lg"
                    >
                        <ExternalLink size={18} />
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
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight text-left">Master Results</h1>
                        <p className="text-slate-500 mt-1 text-left text-lg">Aggregated view of automated and manual evaluations.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <Download size={16} /> Export CSV
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={!fromDate && !toDate}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-colors shadow-sm ${(!fromDate && !toDate)
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'}`}
                            title={(!fromDate && !toDate) ? "Select a date range to enable" : "Bulk Delete"}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by candidate name or course..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="bg-transparent border-none text-sm font-medium text-slate-600 focus:outline-none"
                                placeholder="From"
                            />
                        </div>
                        <span className="text-slate-300 font-bold">to</span>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="bg-transparent border-none text-sm font-medium text-slate-600 focus:outline-none"
                                placeholder="To"
                            />
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <DataTable
                        columns={columns}
                        data={paginatedResults}
                        loading={loading}
                        totalItems={totalItems}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={(col, dir) => { setSortBy(col); setSortDir(dir); }}
                        filters={filters}
                        onFilterChange={setFilters}
                        emptyMessage="No results found matching your search."
                    />
                </div>
            </div>
        </SaaSLayout>
    );
}
