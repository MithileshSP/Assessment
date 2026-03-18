import React, { useState, useEffect } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    Database,
    Download,
    Trash2,
    HardDrive,
    FileJson,
    FileSpreadsheet,
    AlertTriangle,
    Clock,
    ShieldCheck,
    RefreshCw,
    Activity,
    Info,
    Calendar
} from 'lucide-react';

const AdminBackup = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cleanupDate, setCleanupDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/backup/stats');
            setStats(res.data);
        } catch (error) {
            console.error("Failed to fetch backup stats", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportResults = async () => {
        setIsExporting(true);
        try {
            const response = await api.get('/admin/results/export', {
                params: { all: 'true' },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `results_export_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export results failed", error);
            alert("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportFullBackup = async () => {
        setIsExporting(true);
        try {
            const response = await api.get('/admin/backup/export-all', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `full_system_backup_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Full backup export failed", error);
            alert("Full backup export failed.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleBulkCleanup = async () => {
        if (!cleanupDate) {
            alert("Please select a date.");
            return;
        }

        const confirmed = window.confirm(
            `CRITICAL ACTION: This will permanently delete all submissions BEFORE ${cleanupDate}.\n\nThis cannot be undone. Are you absolutely sure?`
        );

        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const res = await api.delete('/admin/results/bulk', {
                params: { toDate: cleanupDate }
            });
            alert(res.data.message || "Bulk cleanup completed successfully.");
            fetchStats();
            setCleanupDate('');
        } catch (error) {
            console.error("Bulk cleanup failed", error);
            alert(error.response?.data?.error || "Failed to perform bulk cleanup.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Database size={18} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">System Utility</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Storage & Backups</h1>
                        <p className="text-slate-500 mt-2 font-medium max-w-lg">Manage platform data, export records, and perform storage maintenance to keep the system running efficiently.</p>
                    </div>
                    <button 
                        onClick={fetchStats}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Refresh Stats
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
                                <Activity size={24} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Data</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900">{loading ? '...' : stats?.database?.submissions || 0}</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Total Submissions</p>
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">{stats?.database?.evaluations || 0} Evaluated</span>
                            <ShieldCheck size={14} className="text-emerald-500" />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
                                <Database size={24} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900">{loading ? '...' : stats?.database?.evaluations || 0}</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Evaluations Recorded</p>
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">Total Points Tracked</span>
                            <ShieldCheck size={14} className="text-emerald-500" />
                        </div>
                    </div>

                    <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-200 text-white group cursor-pointer overflow-hidden relative" onClick={handleExportFullBackup}>
                        <div className="absolute -right-4 -bottom-4 opacity-10 transform scale-150 rotate-12 transition-transform group-hover:rotate-0">
                            <Database size={120} />
                        </div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <FileJson size={20} />
                                </div>
                                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Quick Export</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold leading-tight">Generate Full JSON Backup</h3>
                                <p className="text-blue-100 text-xs mt-1 font-medium">Download all submission data as JSON.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Exports Tool */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                                    <Download size={18} />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">Data Export Tools</h2>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">Export specific datasets for compliance and reporting.</p>
                        </div>
                        <div className="p-6 space-y-4 flex-1">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-slate-100 transition-colors cursor-pointer" onClick={handleExportResults}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                                        <FileSpreadsheet size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Results Master Export (CSV)</h4>
                                        <p className="text-[11px] text-slate-500 font-medium">Optimized for Excel/Google Sheets</p>
                                    </div>
                                </div>
                                <div className="p-2 bg-slate-200/50 rounded-lg text-slate-400 group-hover:text-slate-600">
                                    <Download size={16} />
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-slate-100 transition-colors cursor-pointer" onClick={handleExportFullBackup}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                        <FileJson size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">System State Backup (JSON)</h4>
                                        <p className="text-[11px] text-slate-500 font-medium">Complete record including code and assets</p>
                                    </div>
                                </div>
                                <div className="p-2 bg-slate-200/50 rounded-lg text-slate-400 group-hover:text-slate-600">
                                    <Download size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cleanup Tool */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                        <div className="p-6 border-b border-slate-100 bg-rose-50/30">
                            <div className="flex items-center gap-3 mb-2 text-rose-600">
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                    <Trash2 size={18} />
                                </div>
                                <h2 className="text-lg font-bold">Storage Maintenance</h2>
                            </div>
                            <p className="text-sm text-slate-600 font-medium">Remove old records to free up server space.</p>
                        </div>
                        <div className="p-6 space-y-6 flex-1">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-2">
                                    <Calendar size={14} /> Cutoff Date
                                </label>
                                <div className="flex gap-3">
                                    <input 
                                        type="date" 
                                        value={cleanupDate}
                                        onChange={(e) => setCleanupDate(e.target.value)}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                    <button 
                                        disabled={!cleanupDate || isDeleting}
                                        onClick={handleBulkCleanup}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                            !cleanupDate || isDeleting 
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                            : 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 active:scale-95'
                                        }`}
                                    >
                                        {isDeleting ? 'Cleaning...' : 'Purge Old Data'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50 flex items-start gap-4">
                                <div className="p-1.5 bg-amber-200 text-amber-700 rounded-lg mt-0.5">
                                    <AlertTriangle size={16} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Safety First</p>
                                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">Ensure you have exported a full backup before performing maintenance. This action permanently deletes database records and their associated image files from the server.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integration Info */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-white/10 group-hover:rotate-6 transition-transform">
                            <RefreshCw size={40} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight mb-2">Manual Data Restoration</h2>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-2xl">
                                Need to restore a missing submission from a backup? Use our internal scripts or contact technical support to import specific JSON records back into the active database. 
                                <span className="block mt-2 text-blue-400/80 italic font-bold">Tip: Always verify user roll numbers during manual imports.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
};

export default AdminBackup;
