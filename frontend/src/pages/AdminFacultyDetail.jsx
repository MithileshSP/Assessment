import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Mail, Phone, Briefcase, Clock,
    CheckCircle, AlertCircle, TrendingUp, MoreHorizontal,
    Plus, Shuffle, ArrowRightLeft, Search, Filter, X, UserPlus
} from 'lucide-react';
import api from '../services/api';
import DataTable, { StatusBadge } from '../components/DataTable';
import { formatIST } from '../utils/date';
import SaaSLayout from '../components/SaaSLayout';

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

export default function AdminFacultyDetail() {
    const { facultyId } = useParams();
    const navigate = useNavigate();
    const [faculty, setFaculty] = useState(null);
    const [allFaculty, setAllFaculty] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('assigned'); // assigned, pending, history
    const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

    // Capacity Editing State
    const [isEditingCapacity, setIsEditingCapacity] = useState(false);
    const [tempCapacity, setTempCapacity] = useState('');

    // Add states for reallocation
    const [selectedSubs, setSelectedSubs] = useState(new Set());
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        loadData();
    }, [facultyId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Faculty Info
            const facultyRes = await api.get('/admin/faculty-load');
            setAllFaculty(facultyRes.data);
            const currentFaculty = facultyRes.data.find(f => f.id.toString() === facultyId);
            setFaculty(currentFaculty);

            // Fetch Submissions
            const subRes = await api.get('/admin/all-submissions?limit=1000');
            const allSubs = subRes.data.data || [];
            const facultySubs = allSubs.filter(s => s.faculty_id?.toString() === facultyId);

            setSubmissions(facultySubs);
            setStats({
                total: facultySubs.length,
                pending: facultySubs.filter(s => !['passed', 'failed'].includes(s.assignment_status)).length,
                completed: facultySubs.filter(s => ['passed', 'failed'].includes(s.assignment_status)).length
            });

        } catch (e) {
            console.error("Failed to load details", e);
            showToast("Failed to load faculty details", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleReallocate = async (targetFacultyId) => {
        if (selectedSubs.size === 0) return;
        setActionLoading(true);
        try {
            const res = await api.post('/admin/bulk-assign', {
                submissionIds: [...selectedSubs],
                facultyId: targetFacultyId
            });
            const d = res.data;
            showToast(`Reallocated ${d.assigned}, skipped ${d.skipped}${d.errors?.length ? ` — ${d.errors[0]?.reason}` : ''}`);
            setSelectedSubs(new Set());
            setReassignModalOpen(false);
            loadData();
        } catch (err) {
            showToast(err.response?.data?.error || 'Reallocation failed', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveCapacity = async () => {
        const val = parseInt(tempCapacity, 10);
        if (isNaN(val) || val < 1 || val > 100) {
            showToast('Capacity must be between 1 and 100', 'error');
            return;
        }
        setActionLoading(true);
        try {
            await api.patch(`/admin/faculty/${facultyId}/capacity`, { maxCapacity: val });
            showToast('Capacity updated successfully');
            setIsEditingCapacity(false);
            loadData(); // Reload to get updated capacity and percentages
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update capacity', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading profile...</div>;
    if (!faculty) return <div className="p-8 text-center">Faculty not found</div>;

    // Filter Submissions based on Tab
    const filteredSubmissions = submissions.filter(s => {
        if (activeTab === 'assigned') return true;
        if (activeTab === 'pending') return !['passed', 'failed'].includes(s.assignment_status);
        if (activeTab === 'history') return ['passed', 'failed'].includes(s.assignment_status);
        return true;
    });

    return (
        <SaaSLayout>
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'} animate-fade-in-up`}
                >
                    {toast.msg}
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6 pb-20">
                {/* Sticky Header / Top Bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-0 z-10">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        {/* Profile Info */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin/faculty')}
                                className="flex items-center gap-2 px-3 py-1.5 -ml-2 hover:bg-slate-100 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <ChevronLeft size={20} />
                                Back
                            </button>
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/20">
                                {(faculty.full_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">{faculty.full_name}</h1>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                    <span className="flex items-center gap-1.5"><Mail size={14} /> {faculty.email}</span>
                                    <span className="hidden sm:flex items-center gap-1.5"><Briefcase size={14} /> Faculty</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            {selectedSubs.size > 0 && (
                                <button
                                    onClick={() => setReassignModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
                                >
                                    <ArrowRightLeft size={16} />
                                    Reallocate ({selectedSubs.size})
                                </button>
                            )}
                            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">
                                <Shuffle size={16} />
                                Auto Balance
                            </button>
                            {/* <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-600/10">
                                <Plus size={16} />
                                Assign Submissions
                            </button> */}
                        </div>
                    </div>

                    {/* Workload Section */}
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex flex-col sm:flex-row items-center gap-8">
                            {/* Bar */}
                            <div className="flex-1 w-full sm:max-w-md">
                                <div className="flex justify-between items-center text-sm font-semibold mb-2">
                                    <span className="text-slate-700">Current Workload</span>
                                    <div className="flex items-center gap-2">
                                        {isEditingCapacity ? (
                                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-md border border-slate-200">
                                                <input
                                                    type="number"
                                                    min="1" max="100"
                                                    value={tempCapacity}
                                                    onChange={(e) => setTempCapacity(e.target.value)}
                                                    className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-center outline-none focus:border-blue-500 font-bold"
                                                    autoFocus
                                                />
                                                <div className="flex items-center gap-1">
                                                    <button onClick={handleSaveCapacity} disabled={actionLoading} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">Save</button>
                                                    <button onClick={() => setIsEditingCapacity(false)} disabled={actionLoading} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300 disabled:opacity-50">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-slate-900">{faculty.current_load} / {faculty.max_capacity}</span>
                                                <button
                                                    onClick={() => { setIsEditingCapacity(true); setTempCapacity(faculty.max_capacity?.toString() || '10'); }}
                                                    className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 rounded-full relative overflow-hidden"
                                        style={{ width: `${Math.min((faculty.current_load / faculty.max_capacity) * 100, 100)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20" />
                                    </div>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-start">
                                <div className="text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assigned</p>
                                    <p className="text-xl font-bold text-slate-900">{stats.total}</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending</p>
                                    <p className="text-xl font-bold text-blue-600">{stats.pending}</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Completed</p>
                                    <p className="text-xl font-bold text-emerald-600">{stats.completed}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-6 mt-8 -mb-6">
                        {['assigned', 'pending', 'history'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 text-sm font-bold capitalize border-b-2 transition-all ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <DataTable
                        columns={[
                            {
                                key: 'student_name', label: 'Student', filterable: true, renderCell: (v, r) => (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                            {v[0]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{v}</p>
                                            <p className="text-xs text-slate-500">{r.student_email}</p>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                key: 'course_title', label: 'Course', filterable: true,
                                filterOptions: [...new Set(submissions.map(s => s.course_title).filter(Boolean))],
                                renderCell: (v) => <span className="font-medium text-slate-700">{v}</span>
                            },
                            {
                                key: 'level', label: 'Level', width: '80px', filterable: true,
                                filterOptions: [...new Set(submissions.map(s => s.level).filter(Boolean))],
                                renderCell: (v) => <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">Lvl {v}</span>
                            },
                            { key: 'submitted_at', label: 'Submitted', renderCell: (v) => <span className="text-slate-500 text-sm">{v ? formatIST(v) : '-'}</span> },
                            {
                                key: 'assignment_status', label: 'Status', filterable: true,
                                filterOptions: [...new Set(submissions.map(s => s.assignment_status).filter(Boolean))],
                                renderCell: (v) => <StatusBadge value={v} />
                            },
                            {
                                key: 'id', label: 'Action', width: '100px', renderCell: (v) => (
                                    <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                        Review
                                    </button>
                                )
                            }
                        ]}
                        data={filteredSubmissions}
                        loading={loading}
                        selectable={true}
                        checkable
                        checkedIds={selectedSubs}
                        onCheck={setSelectedSubs}
                        onSelectionChange={setSelectedSubs}
                        selectedIds={selectedSubs}
                        emptyMessage="No submissions found for this tab."
                    />
                </div>
            </div>

            {/* Reallocate Modal */}
            <FacultyPickerModal
                isOpen={reassignModalOpen}
                onClose={() => setReassignModalOpen(false)}
                faculty={allFaculty.filter(f => f.id.toString() !== facultyId)}
                onSelect={handleReallocate}
                loading={actionLoading}
                title={`Reallocate ${selectedSubs.size} Submission${selectedSubs.size !== 1 ? 's' : ''}`}
            />
        </SaaSLayout>
    );
}
