import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import DataTable, { StatusBadge } from '../components/DataTable';
import api from '../services/api';
import {
    Users, RefreshCw, BarChart3, Clock, Package, Check, Search,
    Activity, Shield, ChevronRight, Download, UserPlus, Shuffle,
    AlertTriangle, Zap, Settings, X, Eye, UserCheck, UserX,
    ChevronDown, FileText, TrendingUp, MoreHorizontal, ArrowRight,
    Filter
} from 'lucide-react';
import { formatIST } from '../utils/date';

// ─── TAB CONFIG ─────────────────────────────────────────────
const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'submissions', label: 'All Submissions', icon: Package },
    { id: 'roster', label: 'Faculty Roster', icon: Users },
    { id: 'audit', label: 'Audit Log', icon: Shield },
];

// ─── Metric Card (Minimal) ──────────────────────────────────
function MetricCard({ icon: Icon, label, value, trend, loading, color = 'blue' }) {
    const textColors = {
        blue: 'text-blue-600',
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        rose: 'text-rose-600',
        purple: 'text-purple-600',
        slate: 'text-slate-600',
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
                <div className={`p-2 rounded-xl bg-slate-50 ${textColors[color] || 'text-slate-400'} group-hover:scale-110 transition-transform`}>
                    <Icon size={18} />
                </div>
            </div>
            {loading ? (
                <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
                <p className="text-3xl font-black text-slate-900 tabular-nums">{value}</p>
            )}
            {trend && <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">{trend}</p>}
        </div>
    );
}

// ─── Capacity Bar (Minimal) ─────────────────────────────────
function CapacityBar({ current, max, compact = false }) {
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div className={`flex items-center gap-2 ${compact ? '' : 'min-w-[100px]'}`}>
            <div className={`flex-1 bg-slate-100 rounded-full overflow-hidden ${compact ? 'h-1' : 'h-1.5'}`}>
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-medium text-slate-500 tabular-nums whitespace-nowrap">{current}/{max}</span>
        </div>
    );
}

// ─── Faculty Submissions List ───────────────────────────────
function FacultySubmissionsList({ facultyId }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

    useEffect(() => {
        loadData();
    }, [facultyId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Re-using the main submissions endpoint but filtering by faculty and status locally or via params if supported
            // Ensuring we get submissions assigned to this faculty
            const res = await api.get(`/admin/all-submissions?page=1&limit=100`);
            // Note: Ideally backend should support filtering by facultyId. 
            // For now, filtering client-side from recent list or assuming endpoint supports it.
            // If strictly needed, we might need a new endpoint or filter param. 
            // Let's try to filter the response data for now.
            const allSubs = res.data.data || [];
            const facultySubs = allSubs.filter(s => s.faculty_id === facultyId);

            setData(facultySubs);
            setStats({
                total: facultySubs.length,
                pending: facultySubs.filter(s => !['passed', 'failed'].includes(s.assignment_status)).length,
                completed: facultySubs.filter(s => ['passed', 'failed'].includes(s.assignment_status)).length
            });
        } catch (e) {
            console.error('Failed to load faculty submissions', e);
        } finally {
            setLoading(false);
        }
    };

    const cols = [
        { key: 'student_name', label: 'Student', renderCell: (v, r) => <div><p className="font-medium text-xs text-slate-900">{v}</p><p className="text-[10px] text-slate-500">{r.student_email}</p></div> },
        { key: 'course_title', label: 'Course', renderCell: (v) => <span className="text-xs text-slate-600">{v}</span> },
        { key: 'level', label: 'Lvl', width: '50px', renderCell: (v) => <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">{v}</span> },
        { key: 'assignment_status', label: 'Status', renderCell: (v) => <StatusBadge value={v} /> },
        { key: 'submitted_at', label: 'Date', renderCell: (v) => <span className="text-[10px] text-slate-400">{v ? formatIST(v).split(',')[0] : '-'}</span> },
    ];

    if (loading) return <div className="p-4 text-center text-xs text-slate-500">Loading assignments...</div>;
    if (data.length === 0) return <div className="p-4 text-center text-xs text-slate-400 italic">No submissions assigned currently.</div>;

    return (
        <div className="mt-2 border border-slate-100 rounded-md overflow-hidden">
            <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex gap-4 text-[10px] uppercase font-bold text-slate-500">
                <span>Total: {stats.total}</span>
                <span className="text-blue-600">Pending: {stats.pending}</span>
                <span className="text-emerald-600">Completed: {stats.completed}</span>
            </div>
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                        {cols.map(c => <th key={c.key} className="px-3 py-2 font-semibold" style={{ width: c.width }}>{c.label}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                            {cols.map(c => (
                                <td key={c.key} className="px-3 py-2 text-slate-700">
                                    {c.renderCell ? c.renderCell(row[c.key], row) : row[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Faculty Picker Modal ───────────────────────────────────
function FacultyPickerModal({ isOpen, onClose, faculty, onSelect, loading, title }) {
    const [search, setSearch] = useState('');
    if (!isOpen) return null;

    const filtered = faculty.filter(f =>
        !search.trim() ||
        (f.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up border border-slate-100">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <h3 className="text-sm font-bold text-slate-800">{title || 'Select Faculty'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Find faculty member..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
                    {filtered.length === 0 ? (
                        <p className="text-center py-6 text-xs text-slate-400">No matches found</p>
                    ) : (
                        filtered.map(f => (
                            <button
                                key={f.id}
                                onClick={() => onSelect(f.id)}
                                disabled={loading || (f.current_load >= f.max_capacity)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
                            >
                                <div className="w-8 h-8 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 transition-all">
                                    {(f.full_name || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs font-semibold text-slate-700 truncate">{f.full_name}</p>
                                        <span className="text-[10px] text-slate-400">{f.email}</span>
                                    </div>
                                    <CapacityBar current={f.current_load ?? f.pending ?? 0} max={f.max_capacity ?? 10} compact />
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function AdminAssignment() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [toast, setToast] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    // ── Dashboard state ──
    const [facultyLoad, setFacultyLoad] = useState([]);
    const [unassigned, setUnassigned] = useState([]);
    const [dashLoading, setDashLoading] = useState(true);

    // ── Submissions tab state ──
    const [subData, setSubData] = useState([]);
    const [subTotal, setSubTotal] = useState(0);
    const [subPage, setSubPage] = useState(1);
    const [subPageSize, setSubPageSize] = useState(25);
    const [subSearch, setSubSearch] = useState('');
    const [subSortBy, setSubSortBy] = useState('submitted_at');
    const [subSortDir, setSubSortDir] = useState('desc');
    const [subFilters, setSubFilters] = useState({});
    const [subLoading, setSubLoading] = useState(false);
    const [selectedSubs, setSelectedSubs] = useState(new Set());

    // ── Roster state ──
    const [rosterSearch, setRosterSearch] = useState('');
    const [rosterFilter, setRosterFilter] = useState('all');
    const [expandedFaculty, setExpandedFaculty] = useState(null);
    const [editingCapacity, setEditingCapacity] = useState(null);
    // New: state for tracking which tab is active within a faculty detail view if we had multiple. 
    // For now, expanding just shows the details + submissions.

    // ── Audit state ──
    const [auditData, setAuditData] = useState([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditPage, setAuditPage] = useState(1);
    const [auditPageSize, setAuditPageSize] = useState(50);
    const [auditFilters, setAuditFilters] = useState({});
    const [auditLoading, setAuditLoading] = useState(false);

    // ── Modal ──
    const [bulkFacultyModal, setBulkFacultyModal] = useState(false);

    // ── Helpers ──
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ═══════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════

    const loadDashboard = useCallback(async () => {
        try {
            setDashLoading(true);
            const [facRes, unRes] = await Promise.all([
                api.get('/admin/faculty-load'),
                api.get('/admin/unassigned-submissions')
            ]);
            setFacultyLoad(facRes.data);
            setUnassigned(unRes.data);
        } catch (e) {
            showToast('Failed to load dashboard', 'error');
        } finally {
            setDashLoading(false);
        }
    }, [showToast]);

    const loadSubmissions = useCallback(async () => {
        try {
            setSubLoading(true);
            const params = new URLSearchParams({
                page: subPage,
                limit: subPageSize,
                sortBy: subSortBy,
                sortDir: subSortDir,
            });
            if (subSearch) params.set('search', subSearch);
            if (subFilters.assignment_status?.checked?.length) {
                params.set('status', subFilters.assignment_status.checked[0]);
            }
            if (subFilters.faculty_name?.checked?.length) {
                params.set('facultyName', subFilters.faculty_name.checked[0]);
            }
            if (subFilters.course_title?.checked?.length) {
                params.set('courseTitle', subFilters.course_title.checked[0]);
            }
            if (subFilters.level?.checked?.length) {
                params.set('level', subFilters.level.checked[0]);
            }
            if (subFilters.student_name?.text) {
                params.set('studentName', subFilters.student_name.text);
            }

            const res = await api.get(`/admin/all-submissions?${params}`);
            setSubData(res.data.data || []);
            setSubTotal(res.data.pagination?.total || 0);
        } catch (e) {
            showToast('Failed to load submissions', 'error');
        } finally {
            setSubLoading(false);
        }
    }, [subPage, subPageSize, subSearch, subSortBy, subSortDir, subFilters, showToast]);

    const loadAudit = useCallback(async () => {
        try {
            setAuditLoading(true);
            const params = new URLSearchParams({
                page: auditPage,
                limit: auditPageSize,
            });
            if (auditFilters.action_type?.checked?.length) {
                params.set('actionType', auditFilters.action_type.checked[0]);
            }

            const res = await api.get(`/admin/assignment-logs?${params}`);
            setAuditData(res.data.data || []);
            setAuditTotal(res.data.pagination?.total || 0);
        } catch (e) {
            showToast('Failed to load audit log', 'error');
        } finally {
            setAuditLoading(false);
        }
    }, [auditPage, auditPageSize, auditFilters, showToast]);

    // Load on tab switch
    useEffect(() => {
        if (activeTab === 'dashboard') loadDashboard();
        else if (activeTab === 'roster') loadDashboard();
    }, [activeTab, loadDashboard]);

    useEffect(() => {
        if (activeTab === 'submissions') loadSubmissions();
    }, [activeTab, loadSubmissions]);

    useEffect(() => {
        if (activeTab === 'audit') loadAudit();
    }, [activeTab, loadAudit]);

    // ═══════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════

    const handleSmartAssign = async () => {
        setActionLoading('smart');
        try {
            const res = await api.post('/admin/assign/smart');
            showToast(`Smart assign: ${res.data.assignedCount} assigned`);
            loadDashboard();
            if (activeTab === 'submissions') loadSubmissions();
        } catch (err) { showToast(err.response?.data?.error || 'Smart assign failed', 'error'); }
        finally { setActionLoading(null); }
    };

    const handleBulkAssign = async (facultyId) => {
        if (selectedSubs.size === 0) return;
        setActionLoading('bulk');
        try {
            const res = await api.post('/admin/bulk-assign', {
                submissionIds: [...selectedSubs],
                facultyId
            });
            const d = res.data;
            showToast(`Assigned ${d.assigned}, skipped ${d.skipped}${d.errors?.length ? ` — ${d.errors[0]?.reason}` : ''}`);
            setSelectedSubs(new Set());
            setBulkFacultyModal(false);
            loadSubmissions();
            loadDashboard();
        } catch (err) { showToast(err.response?.data?.error || 'Bulk assign failed', 'error'); }
        finally { setActionLoading(null); }
    };

    const toggleAvailability = async (fid, cur) => {
        setActionLoading(`avail-${fid}`);
        try {
            await api.patch(`/admin/faculty/${fid}/availability`, { isAvailable: !cur });
            showToast(`Faculty ${!cur ? 'enabled' : 'disabled'}`);
            loadDashboard();
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
        finally { setActionLoading(null); }
    };

    const updateCapacity = async (fid) => {
        if (!editingCapacity || editingCapacity.fid !== fid) return;
        const val = parseInt(editingCapacity.value);
        if (isNaN(val) || val < 1 || val > 100) { showToast('Must be 1–100', 'error'); return; }
        setActionLoading(`cap-${fid}`);
        try {
            await api.patch(`/admin/faculty/${fid}/capacity`, { maxCapacity: val });
            showToast('Capacity updated');
            setEditingCapacity(null);
            loadDashboard();
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
        finally { setActionLoading(null); }
    };

    const handleRedistribute = async (fromId) => {
        setActionLoading(`redist-${fromId}`);
        try {
            const res = await api.post('/admin/assign/redistribute', { fromFacultyId: fromId });
            showToast(`${res.data.redistributedCount} redistributed`);
            loadDashboard();
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
        finally { setActionLoading(null); }
    };

    const handleExportCSV = async () => {
        try {
            const res = await api.get('/admin/all-submissions?page=1&limit=10000');
            const rows = res.data.data || [];
            if (rows.length === 0) { showToast('No data to export', 'error'); return; }

            const headers = ['ID', 'Student', 'Course', 'Level', 'Submitted', 'Assignment Status', 'Faculty'];
            const csv = [
                headers.join(','),
                ...rows.map(r => [
                    r.id, `"${r.student_name || ''}"`, `"${r.course_title || ''}"`, r.level,
                    `"${r.submitted_at || ''}"`, r.assignment_status || 'unassigned', `"${r.faculty_name || ''}"`
                ].join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `submissions_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('CSV exported');
        } catch (e) { showToast('Export failed', 'error'); }
    };

    const handleExportBackup = async () => {
        try {
            const response = await api.get('/faculty/export-backup', {
                responseType: 'blob'
            });

            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                const text = await response.data.text();
                const json = JSON.parse(text);
                showToast(json.message || 'Export failed', 'error');
                return;
            }

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

    // ── Derived stats ──
    const totalPending = facultyLoad.reduce((a, f) => a + (f.pending || 0), 0);
    const totalCompleted = facultyLoad.reduce((a, f) => a + (f.completed || 0), 0);
    const overloadedCount = facultyLoad.filter(f => (f.current_load ?? f.pending ?? 0) >= (f.max_capacity ?? 10)).length;

    const filteredRoster = useMemo(() => {
        let res = facultyLoad;

        // Search
        if (rosterSearch.trim()) {
            const q = rosterSearch.toLowerCase();
            res = res.filter(f =>
                (f.full_name || '').toLowerCase().includes(q) ||
                (f.email || '').toLowerCase().includes(q)
            );
        }

        // Filter
        if (rosterFilter !== 'all') {
            res = res.filter(f => {
                const loadPct = f.max_capacity > 0 ? (f.current_load / f.max_capacity) * 100 : 0;
                if (rosterFilter === 'overloaded') return loadPct >= 80;
                if (rosterFilter === 'available') return loadPct < 80 && loadPct > 0;
                if (rosterFilter === 'idle') return loadPct === 0;
                return true;
            });
        }
        return res;
    }, [facultyLoad, rosterSearch, rosterFilter]);

    // ═══════════════════════════════════════════════════════════
    // COLUMN DEFINITIONS
    // ═══════════════════════════════════════════════════════════

    const navigate = useNavigate(); // Hooks must be at top level but placing here for context of usage in columns

    const handleDeleteSubmission = useCallback(async (id) => {
        if (!window.confirm("Are you sure you want to manually delete this submission? This action cannot be undone.")) return;

        try {
            await api.delete(`/admin/submissions/${id}`);
            showToast('Submission deleted successfully');
            loadSubmissions(); // Refresh table
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to delete submission', 'error');
        }
    }, [loadSubmissions, showToast]);

    const submissionCols = useMemo(() => [
        {
            key: 'student_name', label: 'Student', sortable: true, filterable: true,
            renderCell: (v, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {(v || '?')[0]}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-900 text-xs">{v || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">{row.student_email}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'course_title', label: 'Course', sortable: true, filterable: true,
            filterOptions: ['HTML / CSS - Level 1', 'JavaScript - Level 2', 'React - Level 3'],
            renderCell: (v) => <span className="font-medium text-slate-700 text-xs">{v || '—'}</span>
        },
        {
            key: 'level', label: 'Lvl', sortable: true, width: '50px', filterable: true,
            filterOptions: [1, 2, 3],
            renderCell: (v) => (
                <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">{v ?? '-'}</span>
            )
        },
        {
            key: 'assignment_status', label: 'Status', sortable: true, filterable: true,
            filterOptions: ['assigned', 'unassigned', 'in_progress', 'evaluated', 'pending', 'passed', 'failed', 'reallocated', 'reopened'],
            renderCell: (v) => <StatusBadge value={v || 'unassigned'} />
        },
        {
            key: 'submitted_at_date', label: 'Date', sortable: true,
            renderCell: (_, row) => {
                if (!row.submitted_at) return <span className="text-xs text-slate-500 font-medium">—</span>;
                const d = new Date(row.submitted_at);
                return <span className="text-xs text-slate-500 font-medium">
                    {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>;
            }
        },
        {
            key: 'submitted_at_time', label: 'Time', sortable: false,
            renderCell: (_, row) => {
                if (!row.submitted_at) return <span className="text-xs text-slate-500 font-medium">—</span>;
                const d = new Date(row.submitted_at);
                return <span className="text-xs text-slate-500 font-medium">
                    {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>;
            }
        },
        {
            key: 'faculty_name', label: 'Assigned To', sortable: true, filterable: true,
            filterOptions: facultyLoad.map(f => f.full_name).filter(Boolean).sort(),
            renderCell: (v, row) => v ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/faculty/${row.faculty_id}`);
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                    {v}
                </button>
            ) : (
                <span className="text-[10px] text-slate-400 italic">Unassigned</span>
            )
        },
        {
            key: 'reallocation_count', label: 'Realloc', width: '60px',
            renderCell: (v) => v > 0 ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] font-bold">
                    <Shuffle size={8} />{v}
                </span>
            ) : <span className="text-slate-200">-</span>
        },
        {
            key: 'actions', label: 'Action', width: '60px',
            renderCell: (_, row) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubmission(row.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete Submission"
                >
                    <X size={16} />
                </button>
            )
        }
    ], [navigate, facultyLoad, handleDeleteSubmission]);

    const auditCols = useMemo(() => [
        {
            key: 'action_type', label: 'Action', filterable: true,
            renderCell: (v) => {
                const colors = {
                    bulk_assign: 'text-blue-700 bg-blue-50',
                    manual_assign: 'text-sky-700 bg-sky-50',
                    auto_assign: 'text-teal-700 bg-teal-50',
                    reassign: 'text-amber-700 bg-amber-50',
                    redistribute: 'text-orange-700 bg-orange-50',
                    faculty_reallocate: 'text-purple-700 bg-purple-50',
                    evaluate: 'text-emerald-700 bg-emerald-50',
                    reopen: 'text-rose-700 bg-rose-50',
                };
                return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors[v] || 'bg-slate-100 text-slate-500'}`}>
                        {(v || '').replace(/_/g, ' ')}
                    </span>
                );
            }
        },
        {
            key: 'submission_id', label: 'Submission',
            renderCell: (v) => <span className="font-mono text-[10px] text-slate-400">{v ? v.slice(0, 8) + '...' : '-'}</span>
        },
        { key: 'from_faculty_name', label: 'From', renderCell: (v) => v || <span className="text-slate-300">-</span> },
        { key: 'to_faculty_name', label: 'To', renderCell: (v) => v || <span className="text-slate-300">-</span> },
        {
            key: 'actor_role', label: 'Actor',
            renderCell: (v) => <span className="text-[10px] font-bold uppercase text-slate-500">{v || 'system'}</span>
        },
        { key: 'admin_name', label: 'Admin', renderCell: (v) => v || <span className="text-slate-300">-</span> },
        {
            key: 'created_at', label: 'Timestamp',
            renderCell: (v) => <span className="text-xs text-slate-500 tabular-nums">{v ? formatIST(v) : '-'}</span>
        },
    ], []);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <SaaSLayout title="Faculty & Assignments" subtitle="Manage workload, assignments, and view logs">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'} animate-fade-in-up`}
                >
                    {toast.msg}
                </div>
            )}

            {/* ── Tab Bar ────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg self-start">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                                ${active
                                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportBackup}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Download size={14} /> Export Backup
                    </button>
                    <button
                        onClick={handleSmartAssign}
                        disabled={actionLoading === 'smart'}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 active:scale-95"
                    >
                        <Zap size={14} />
                        {actionLoading === 'smart' ? 'Assigning...' : 'Smart Assign'}
                    </button>
                </div>
            </div>

            {/* ═══════════ DASHBOARD TAB ═══════════ */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard icon={Package} label="Unassigned" value={unassigned.length} color="amber" loading={dashLoading} />
                        <MetricCard icon={Clock} label="Pending Reviews" value={totalPending} color="blue" loading={dashLoading} />
                        <MetricCard icon={Check} label="Completed" value={totalCompleted} color="emerald" loading={dashLoading} />
                        <MetricCard icon={AlertTriangle} label="Overloaded Faculty" value={overloadedCount} color="rose" loading={dashLoading} />
                    </div>

                    {/* Load Distribution */}
                    <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <BarChart3 size={16} className="text-slate-400" />
                            Workload Distribution
                        </h3>
                        {dashLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />)}
                            </div>
                        ) : facultyLoad.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">No faculty data available.</div>
                        ) : (
                            <div className="space-y-4">
                                {facultyLoad.slice(0, 5).map(f => ( // Show top 5 in dash
                                    <div key={f.id} className="group">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-700">{f.full_name}</span>
                                                <span className="text-[10px] text-slate-400">{f.email}</span>
                                            </div>
                                            <div className="text-slate-500 font-medium">
                                                {f.current_load ?? f.pending ?? 0}/{f.max_capacity ?? 10}
                                            </div>
                                        </div>
                                        <CapacityBar current={f.current_load ?? f.pending ?? 0} max={f.max_capacity ?? 10} />
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => setActiveTab('roster')}
                            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                            View all faculty <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* ═══════════ ALL SUBMISSIONS TAB ═══════════ */}
            {activeTab === 'submissions' && (
                <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-md border border-slate-200 shadow-sm">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search submissions..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={subSearch}
                                onChange={e => setSubSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                <Download size={14} /> Export CSV
                            </button>
                            {selectedSubs.size > 0 && (
                                <button
                                    onClick={() => setBulkFacultyModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 shadow-sm"
                                >
                                    <UserPlus size={14} /> Assign ({selectedSubs.size})
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                        <DataTable
                            columns={submissionCols}
                            data={subData}
                            loading={subLoading}
                            totalItems={subTotal}
                            page={subPage}
                            pageSize={subPageSize}
                            onPageChange={setSubPage}
                            onPageSizeChange={setSubPageSize}
                            sortBy={subSortBy}
                            sortDir={subSortDir}
                            onSort={(col, dir) => { setSubSortBy(col); setSubSortDir(dir); }}
                            selectable={true}
                            selectedIds={selectedSubs}
                            onSelectionChange={setSelectedSubs}
                            filters={subFilters}
                            onFilterChange={setSubFilters}
                            emptyMessage="No submissions found matching criteria."
                        />
                    </div>
                </div>
            )}

            {/* ═══════════ FACULTY ROSTER TAB ═══════════ */}
            {activeTab === 'roster' && (
                <div className="space-y-6">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search faculty by name or email..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-sm"
                                value={rosterSearch}
                                onChange={(e) => setRosterSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                            {['all', 'overloaded', 'available', 'idle'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setRosterFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap capitalize ${rosterFilter === f
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    {filteredRoster.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <Users className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-lg font-medium text-slate-900">No faculty found</h3>
                            <p className="text-slate-500 text-sm">Try adjusting your filters or search query</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                            {filteredRoster.map(f => (
                                <FacultyCard key={f.id} faculty={f} onClick={() => navigate(`/admin/faculty/${f.id}`)} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ AUDIT LOG TAB ═══════════ */}
            {activeTab === 'audit' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">System audit trail for assignment actions.</p>
                    <DataTable
                        columns={auditCols}
                        data={auditData}
                        totalItems={auditTotal}
                        page={auditPage}
                        pageSize={auditPageSize}
                        onPageChange={setAuditPage}
                        onPageSizeChange={(s) => { setAuditPageSize(s); setAuditPage(1); }}
                        filters={auditFilters}
                        onFilterChange={(key, val) => { setAuditFilters(prev => ({ ...prev, [key]: val })); setAuditPage(1); }}
                        loading={auditLoading}
                        manualPagination
                    />
                </div>
            )}

            {/* ── Modals ── */}
            <FacultyPickerModal
                isOpen={bulkFacultyModal}
                onClose={() => setBulkFacultyModal(false)}
                faculty={facultyLoad}
                onSelect={(fid) => handleBulkAssign(fid)}
                title={`Assign ${selectedSubs.size} Submission${selectedSubs.size !== 1 ? 's' : ''}`}
            />
        </SaaSLayout>
    );
}

function FacultyCard({ faculty, onClick }) {
    const loadPct = faculty.max_capacity > 0 ? (faculty.current_load / faculty.max_capacity) * 100 : 0;

    // Color Logic
    let statusColor = 'bg-emerald-500';
    let statusText = 'text-emerald-700';

    if (loadPct >= 80) {
        statusColor = 'bg-rose-500';
        statusText = 'text-rose-700';
    } else if (loadPct >= 50) {
        statusColor = 'bg-amber-500';
        statusText = 'text-amber-700';
    }

    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col relative"
        >
            {/* Hover Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            {(faculty.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm line-clamp-1" title={faculty.full_name}>{faculty.full_name}</h3>
                            <p className="text-xs text-slate-500 line-clamp-1" title={faculty.email}>{faculty.email}</p>
                        </div>
                    </div>
                </div>

                {/* Workload Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                        <span className="text-slate-600">Workload</span>
                        <span className={`${statusText}`}>{faculty.current_load} / {faculty.max_capacity}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${statusColor} rounded-full transition-all duration-500 ease-out`}
                            style={{ width: `${Math.min(loadPct, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Mini Stats */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100 group-hover:border-slate-200 transition-colors">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assigned</p>
                        <p className="text-sm font-bold text-slate-900">{faculty.current_load}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100 group-hover:border-slate-200 transition-colors">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending</p>
                        <p className="text-sm font-bold text-slate-900">{faculty.pending || '-'}</p>
                    </div>
                </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between group-hover:bg-blue-50/30 transition-colors">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600 transition-colors">View Details</span>
                <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-all" />
            </div>
        </div>
    );
}
