import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    Trophy,
    Search,
    Filter,
    Download,
    ExternalLink,
    User,
    BookOpen
} from 'lucide-react';

export default function AdminResults() {
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

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
            const response = await api.get('/admin/results/export', {
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

    const filteredResults = results.filter(r =>
        r.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.course_title?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SaaSLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight text-left">Master Results</h1>
                        <p className="text-slate-500 mt-1 text-left">Aggregated view of automated and manual evaluations.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <Download size={16} /> Export CSV
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
                    <button className="flex items-center gap-2 px-6 py-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                        <Filter size={18} /> Filters
                    </button>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 text-slate-500 font-bold text-[11px] uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-left">Candidate / Test</th>
                                    <th className="px-6 py-4 text-center">Final Status</th>
                                    <th className="px-6 py-4 text-center">Auto Score</th>
                                    <th className="px-6 py-4 text-center">Manual Score</th>
                                    <th className="px-6 py-4 text-left">Evaluator</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="6" className="p-20 text-center text-slate-400">Loading master results...</td></tr>
                                ) : filteredResults.length === 0 ? (
                                    <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-medium">No results found matching your search.</td></tr>
                                ) : (
                                    filteredResults.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
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
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider border ${row.final_status === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    row.final_status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                    {row.final_status || 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono font-bold text-slate-600">
                                                {row.auto_score !== null ? `${row.auto_score}%` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
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
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-500 text-xs">
                                                {row.evaluator_name ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-[8px] font-bold">
                                                            {row.evaluator_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        {row.evaluator_name}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/admin/submission/${row.id}`)}
                                                    className="p-2 text-slate-300 hover:text-blue-600 transition-colors bg-transparent hover:bg-blue-50 rounded-lg"
                                                >
                                                    <ExternalLink size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
}
