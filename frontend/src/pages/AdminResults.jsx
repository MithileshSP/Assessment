import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import { Trophy, Search, Filter, Download, ExternalLink, User, BookOpen, Calendar, Trash2, Upload, X, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import DataTable, { StatusBadge } from '../components/DataTable';
import SummaryAnalytics from '../components/SummaryAnalytics';

export default function AdminResults() {
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [stats, setStats] = useState(null);
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

    // Import state
    const fileInputRef = useRef(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [parsedRows, setParsedRows] = useState([]);
    const [parsedFields, setParsedFields] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    useEffect(() => {
        loadResults();
    }, []);

    const loadResults = async () => {
        try {
            const response = await api.get('/admin/results');
            setResults(response.data.data || []);
            setStats(response.data.summary || null);
        } catch (error) {
            console.error('Failed to load results:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset to page 1 on filter change
    };

    // Reset page 1 on search change
    useEffect(() => {
        setPage(1);
    }, [search]);

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

    // ── Import CSV Logic ──────────────────────────────────────
    const loadPapaParse = () => {
        return new Promise((resolve, reject) => {
            if (window.Papa) return resolve(window.Papa);
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
            script.onload = () => resolve(window.Papa);
            script.onerror = () => reject(new Error('Failed to load CSV parser'));
            document.head.appendChild(script);
        });
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset the file input so re-selecting the same file triggers change
        e.target.value = '';

        try {
            const Papa = await loadPapaParse();
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length === 0) {
                        alert('The CSV file is empty or could not be parsed.');
                        return;
                    }
                    setParsedRows(results.data);
                    setParsedFields(results.meta.fields || []);
                    setImportResult(null);
                    setImportModalOpen(true);
                },
                error: (err) => {
                    alert('CSV parsing error: ' + err.message);
                }
            });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleImportConfirm = async () => {
        setImporting(true);
        setImportResult(null);
        try {
            const response = await api.post('/submissions/import', { submissions: parsedRows });
            setImportResult(response.data);
            loadResults(); // Refresh table
        } catch (error) {
            setImportResult({
                message: 'Import failed',
                added: 0,
                skipped: parsedRows.length,
                total: parsedRows.length,
                errors: [error.response?.data?.error || error.message]
            });
        } finally {
            setImporting(false);
        }
    };

    // Client-side filtering, sorting, and pagination
    let processed = results.filter(r => {
        const s = (search || '').trim().toLowerCase();
        if (s) {
            const cName = String(r.candidate_name || '').toLowerCase();
            const cTitle = String(r.course_title || '').toLowerCase();
            const eName = String(r.evaluator_name || '').toLowerCase();
            const uId = String(r.user_id || '').toLowerCase();
            const rollNo = String(r.roll_no || '').toLowerCase();
            if (!cName.includes(s) && !cTitle.includes(s) && !eName.includes(s) && !uId.includes(s) && !rollNo.includes(s)) return false;
        }
        return true;
    });

    // Apply advanced column filters
    Object.entries(filters).forEach(([key, filter]) => {
        if (!filter) return;
        if (filter.checked) {
            // Check case-insensitively or exact match depending on the data type
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

    // Calculate dynamic stats for the summary cards
    const dynamicStats = {
        total: processed.length,
        passed: processed.filter(r => r.final_status === 'passed').length,
        failed: processed.filter(r => r.final_status === 'failed').length,
        autoEvaluated: processed.filter(r => r.auto_score !== null && (r.manual_score === null || r.manual_score === 0)).length
    };

    // Reset to page 1 if filtered results are less than current page offset
    useEffect(() => {
        if (totalItems > 0 && startIndex >= totalItems) {
            setPage(1);
        }
    }, [totalItems, startIndex]);

    // Expected CSV fields for matching display
    const EXPECTED_FIELDS = [
        'Student UID', 'Student Name', 'Email', 'Course', 'Level', 'courseId',
        'title', 'description', 'instructions', 'studentHtml', 'studentCss',
        'studentJs', 'studentScreenshot', 'expectedScreenshot', 'Submitted At'
    ];

    // Define table columns
    const columns = [
        {
            key: 'candidate_name',
            label: 'Candidate / Test',
            sortable: true,
            filterable: true,
            renderCell: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase">
                        {(row.candidate_name || 'A').charAt(0)}
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
            filterOptions: [
                { label: 'PASSED', value: 'passed' },
                { label: 'FAILED', value: 'failed' },
                { label: 'EVALUATING', value: 'evaluating' },
                { label: 'REOPENED', value: 'reopened' },
                { label: 'UNASSIGNED', value: 'unassigned' }
            ],
            renderCell: (val, row) => (
                <div className="flex justify-center">
                    <StatusBadge value={row.final_status} />
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
                                {(row.evaluator_name || '?').charAt(0).toUpperCase()}
                            </div>
                            {row.evaluator_name}
                        </div>
                    ) : '-'}
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
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Upload size={16} /> Import CSV
                        </button>
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

                {/* Live Stats */}
                {!loading && (
                    <div className="mb-6">
                        <SummaryAnalytics metrics={dynamicStats} type="results" />
                    </div>
                )}

                {/* Results Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <DataTable
                        columns={columns}
                        data={paginatedResults}
                        filterData={results} // Use full dataset for generating unique filter values
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
                        onFilterChange={handleFilterChange}
                        onSearch={setSearch}
                        searchValue={search}
                        emptyMessage="No results found matching your filters."
                    />
                </div>
            </div>

            {/* Import Modal */}
            {importModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <FileText size={20} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Import Submissions</h3>
                                    <p className="text-xs text-slate-400">{parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} parsed from CSV</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setImportModalOpen(false); setImportResult(null); }}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
                            {/* Show import result if available */}
                            {importResult ? (
                                <div className="space-y-4">
                                    <div className={`p-4 rounded-xl border ${importResult.added > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {importResult.added > 0 ? (
                                                <CheckCircle size={18} className="text-emerald-600" />
                                            ) : (
                                                <AlertTriangle size={18} className="text-rose-600" />
                                            )}
                                            <span className="font-bold text-sm">{importResult.message}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            <div className="text-center p-2 bg-white/60 rounded-lg">
                                                <p className="text-2xl font-black text-emerald-600">{importResult.added}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Added</p>
                                            </div>
                                            <div className="text-center p-2 bg-white/60 rounded-lg">
                                                <p className="text-2xl font-black text-amber-600">{importResult.skipped}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Skipped</p>
                                            </div>
                                            <div className="text-center p-2 bg-white/60 rounded-lg">
                                                <p className="text-2xl font-black text-slate-600">{importResult.total}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                                            </div>
                                        </div>
                                    </div>

                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                            <p className="text-xs font-bold text-rose-700 mb-2">Errors ({importResult.errors.length})</p>
                                            <div className="max-h-32 overflow-y-auto space-y-1">
                                                {importResult.errors.map((err, idx) => (
                                                    <p key={idx} className="text-[11px] text-rose-600 font-mono">{err}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Field mapping preview */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detected Columns</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {parsedFields.map(field => (
                                                <span
                                                    key={field}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${EXPECTED_FIELDS.includes(field)
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                                        }`}
                                                >
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sample data preview */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Preview (first 3 rows)</p>
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[11px]">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200">
                                                            {parsedFields.slice(0, 6).map(f => (
                                                                <th key={f} className="px-3 py-2 text-left font-bold text-slate-500 uppercase whitespace-nowrap">{f}</th>
                                                            ))}
                                                            {parsedFields.length > 6 && <th className="px-3 py-2 text-slate-400">+{parsedFields.length - 6} more</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {parsedRows.slice(0, 3).map((row, i) => (
                                                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                                                {parsedFields.slice(0, 6).map(f => (
                                                                    <td key={f} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[120px] truncate">{row[f] || '-'}</td>
                                                                ))}
                                                                {parsedFields.length > 6 && <td className="px-3 py-2 text-slate-300">…</td>}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            {importResult ? (
                                <button
                                    onClick={() => { setImportModalOpen(false); setImportResult(null); }}
                                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                                >
                                    Done
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setImportModalOpen(false)}
                                        className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleImportConfirm}
                                        disabled={importing}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {importing ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16} />
                                                Import {parsedRows.length} Rows
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </SaaSLayout>
    );
}