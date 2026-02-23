import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Briefcase, CheckCircle, Clock, AlertTriangle, ChevronRight, User } from 'lucide-react';
import api from '../services/api';
import SaaSLayout from '../components/SaaSLayout';

export default function AdminFacultyList() {
    const navigate = useNavigate();
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all, overloaded, available, idle

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/faculty-load');
            setFaculty(res.data);
        } catch (e) {
            console.error("Failed to load faculty", e);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredFaculty = faculty.filter(f => {
        const matchesSearch = (f.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (f.email || '').toLowerCase().includes(search.toLowerCase());

        let matchesFilter = true;
        const loadPct = f.max_capacity > 0 ? (f.current_load / f.max_capacity) * 100 : 0;

        if (filter === 'overloaded') matchesFilter = loadPct >= 80;
        if (filter === 'available') matchesFilter = loadPct < 80 && loadPct > 0;
        if (filter === 'idle') matchesFilter = loadPct === 0;

        return matchesSearch && matchesFilter;
    });

    // Stats for Header
    const stats = {
        total: faculty.length,
        overloaded: faculty.filter(f => (f.max_capacity > 0 ? (f.current_load / f.max_capacity) * 100 : 0) >= 80).length,
        available: faculty.filter(f => (f.max_capacity > 0 ? (f.current_load / f.max_capacity) * 100 : 0) < 80).length
    };

    return (
        <SaaSLayout>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Faculty Management</h1>
                        <p className="text-sm text-slate-500 mt-1">Monitor workload and assign submissions</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full border border-rose-100">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            <span className="text-xs font-semibold text-rose-700">{stats.overloaded} Overloaded</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-xs font-semibold text-emerald-700">{stats.available} Available</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search faculty by name or email..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                        {['all', 'overloaded', 'available', 'idle'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap capitalize ${filter === f
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse"></div>
                        ))}
                    </div>
                ) : filteredFaculty.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <User className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-lg font-medium text-slate-900">No faculty found</h3>
                        <p className="text-slate-500 text-sm">Try adjusting your filters or search query</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredFaculty.map(f => (
                            <FacultyCard key={f.id} faculty={f} onClick={() => navigate(`/admin/faculty/${f.id}`)} />
                        ))}
                    </div>
                )}
            </div>
        </SaaSLayout>
    );
}

function FacultyCard({ faculty, onClick }) {
    const loadPct = faculty.max_capacity > 0 ? (faculty.current_load / faculty.max_capacity) * 100 : 0;

    // Color Logic
    let statusColor = 'bg-emerald-500';
    let statusBg = 'bg-emerald-50';
    let statusText = 'text-emerald-700';

    if (loadPct >= 80) {
        statusColor = 'bg-rose-500';
        statusBg = 'bg-rose-50';
        statusText = 'text-rose-700';
    } else if (loadPct >= 50) {
        statusColor = 'bg-amber-500';
        statusBg = 'bg-amber-50';
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

                {/* Mini Stats (Mocked for now if API doesn't return breakdown) */}
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
