import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Upload,
    Download,
    FileJson,
    FileSpreadsheet,
    Lock,
    ChevronDown,
    ChevronUp,
    Edit3,
    Trash2,
    ArrowLeft,
    Shield,
    Clock,
    Zap,
    CheckCircle2,
    AlertCircle,
    BookOpen,
    Layout,
    Wrench,
    FileText,
    FileCode
} from 'lucide-react';
import { X } from 'lucide-react';
import SaaSLayout from '../components/SaaSLayout';
import * as api from '../services/api';
import apiClient from '../services/api';
import { getUserRole } from '../utils/session';

const QuestionBank = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const userRole = getUserRole();

    const [course, setCourse] = useState(null);
    const [questionsByLevel, setQuestionsByLevel] = useState({});
    const [expandedLevels, setExpandedLevels] = useState({ 1: true });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');


    // Import Modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);

    // Bulk Delete
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [deleting, setDeleting] = useState(false);
    const [fixingAssets, setFixingAssets] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [courseRes, questionsRes] = await Promise.all([
                api.getCourse(courseId),
                api.getCourseQuestions(courseId)
            ]);

            setCourse(courseRes.data);

            // FLATTEN LEVELS: Treat all questions as belonging to the current single level
            const grouped = {
                1: questionsRes.data || []
            };

            setQuestionsByLevel(grouped);

        } catch (error) {
            console.error('Error fetching course data:', error);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleLevel = (level) => {
        setExpandedLevels(prev => ({
            ...prev,
            [level]: !prev[level]
        }));
    };

    const handleExportCsv = async () => {
        try {
            const response = await apiClient.get(`/challenges/course/${courseId}/export/csv`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `questions_export_${courseId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to export questions:', error);
            alert('Failed to export questions');
        }
    };

    const handleEdit = (question) => {
        navigate(`/admin/course/${courseId}/question/edit/${question.id}`);
    };

    const handleDelete = async (questionId) => {
        if (!confirm('Delete this question?')) return;
        try {
            await api.deleteQuestion(questionId);
            setSelectedQuestions(prev => prev.filter(id => id !== questionId));
            // No fetch needed if we update local state, but fetching is safer
            fetchData();
        } catch (error) {
            alert('Failed to delete question');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedQuestions.length === 0) {
            alert('No questions selected');
            return;
        }
        if (!confirm(`Delete ${selectedQuestions.length} selected questions?`)) return;
        try {
            setDeleting(true);
            await api.bulkDeleteQuestions(courseId, selectedQuestions);
            alert(`Deleted ${selectedQuestions.length} questions successfully!`);
            setSelectedQuestions([]);
            fetchData();
        } catch (error) {
            console.error('Bulk delete error:', error);
            alert('Failed to delete questions: ' + (error.response?.data?.error || error.message));
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelectQuestion = (questionId) => {
        setSelectedQuestions(prev =>
            prev.includes(questionId)
                ? prev.filter(id => id !== questionId)
                : [...prev, questionId]
        );
    };

    const toggleSelectAllInLevel = (lv) => {
        const levelQuestions = questionsByLevel[lv] || [];
        const levelIds = levelQuestions.map(q => q.id);
        const allSelected = levelIds.every(id => selectedQuestions.includes(id));

        if (allSelected) {
            setSelectedQuestions(prev => prev.filter(id => !levelIds.includes(id)));
        } else {
            setSelectedQuestions(prev => [...new Set([...prev, ...levelIds])]);
        }
    };



    const totals = {
        questions: Object.values(questionsByLevel).flat().length,
        levels: 1 // Single level view
    };


    // Extract asset paths from HTML/CSS code
    const extractAssetsFromCode = (html, css) => {
        const combined = (html || '') + (css || '');
        // Matches src="..." or url(...) with optional spaces
        const regex = /(?:src\s*=\s*["']|url\(\s*["']?)([^"')]+\.(?:png|jpg|jpeg|gif|svg|webp))["')]/gi;
        const matches = [...combined.matchAll(regex)];
        const paths = new Set();

        matches.forEach(match => {
            let path = match[1];
            if (!path.startsWith('http') && !path.startsWith('/') && !path.startsWith('assets')) {
                path = path.replace(/^(\.\/)?(\images\/)?/, '');
                path = `/assets/images/${path}`;
            } else if (path.startsWith('images/')) {
                path = `/assets/${path}`;
            }
            paths.add(path);
        });
        return Array.from(paths);
    };

    const handleFixAssets = async () => {
        if (!confirm('This will scan all questions and auto-add missing image assets found in their code. Continue?')) return;
        try {
            setFixingAssets(true);
            const allQuestions = Object.values(questionsByLevel).flat();
            let updatedCount = 0;

            for (const q of allQuestions) {
                const html = q.expectedSolution?.html || q.expectedHtml || '';
                const css = q.expectedSolution?.css || q.expectedCss || '';

                const extracted = extractAssetsFromCode(html, css);
                if (extracted.length === 0) continue;

                // Get existing assets
                let currentAssets = [];
                if (Array.isArray(q.assets)) {
                    currentAssets = q.assets.map(a => (typeof a === 'string' ? a : a.path));
                } else if (q.assets?.images) {
                    currentAssets = q.assets.images.map(img => img.path || img);
                }

                // Check if any new assets found
                const combined = new Set(currentAssets);
                let changed = false;

                extracted.forEach(path => {
                    if (!combined.has(path)) {
                        combined.add(path);
                        changed = true;
                    }
                });

                if (changed) {
                    const newAssetsArray = Array.from(combined);
                    const newAssetsObj = {
                        images: newAssetsArray.map(p => ({
                            name: p.split('/').pop(),
                            path: p,
                            description: 'Auto-extracted'
                        })),
                        reference: q.assets?.reference || ''
                    };

                    await api.updateQuestion(q.id, { ...q, assets: newAssetsObj });
                    updatedCount++;
                }
            }

            alert(`Done! Updated assets for ${updatedCount} questions.`);
            fetchData();
        } catch (error) {
            console.error('Failed to fix assets:', error);
            alert('Bulk fix failed: ' + error.message);
        } finally {
            setFixingAssets(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        try {
            setImporting(true);
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    let questions = [];

                    if (importFile.name.endsWith('.json')) {
                        questions = JSON.parse(content);
                    } else if (importFile.name.endsWith('.csv')) {
                        // Robust CSV parsing for multi-line HTML/CSS
                        const parseCSV = (text) => {
                            const result = [];
                            const lines = text.split(/\r?\n/);
                            let currentLine = [];
                            let currentField = '';
                            let inQuotes = false;

                            for (let row = 0; row < lines.length; row++) {
                                let line = lines[row];
                                for (let i = 0; i < line.length; i++) {
                                    const char = line[i];
                                    if (char === '"' && line[i + 1] === '"') {
                                        currentField += '"';
                                        i++;
                                    } else if (char === '"') {
                                        inQuotes = !inQuotes;
                                    } else if (char === ',' && !inQuotes) {
                                        currentLine.push(currentField.trim());
                                        currentField = '';
                                    } else {
                                        currentField += char;
                                    }
                                }

                                if (!inQuotes) {
                                    currentLine.push(currentField.trim());
                                    result.push(currentLine);
                                    currentLine = [];
                                    currentField = '';
                                } else {
                                    currentField += '\n';
                                }
                            }
                            return result;
                        };

                        const rows = parseCSV(content);
                        if (rows.length < 2) throw new Error('Invalid CSV format');

                        const headers = rows[0];
                        for (let i = 1; i < rows.length; i++) {
                            if (rows[i].length < headers.length) continue;
                            const q = {};
                            headers.forEach((h, idx) => {
                                q[h] = rows[i][idx];
                            });
                            questions.push(q);
                        }
                    }

                    await api.bulkUploadQuestions(courseId, questions);
                    alert(`Imported ${questions.length} questions successfully!`);
                    setShowImportModal(false);
                    setImportFile(null);
                    fetchData();
                } catch (parseErr) {
                    console.error('Parse error:', parseErr);
                    alert('Failed to parse file. Check format.');
                } finally {
                    setImporting(false);
                }
            };
            reader.readAsText(importFile);
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import questions');
            setImporting(false);
        }
    };

    return (
        <SaaSLayout>
            <div className="space-y-6 text-left">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(userRole === 'admin' ? '/admin/courses' : '/faculty/dashboard')}
                            className="p-2.5 bg-white rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="text-left">
                            <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">
                                <BookOpen size={10} />
                                <span>Level Management</span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                                {course?.title || 'Loading...'}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Manage question repository and settings.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/admin/course/${courseId}/question/add`)}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 text-sm"
                        >
                            <Plus size={18} />
                            Add Question
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Stats & Search Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                            <div className="text-left">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Search Database</label>
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Find questions..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Items</p>
                                    <p className="text-2xl font-black text-slate-900 mt-2">{totals.questions}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 text-left">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Levels</p>
                                    <p className="text-2xl font-black text-blue-600 mt-2">1</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <button
                                    onClick={handleExportCsv}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    <Download size={16} />
                                    Export Full Bank
                                </button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-gradient-to-br from-blue-600 to-violet-700 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-200 text-left">
                            <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                                <Zap size={20} className="text-amber-400" />
                                Bulk Operations
                            </h3>
                            <div className="space-y-3">
                                <div className="w-full bg-white/10 p-4 rounded-2xl border border-white/10 transition-all text-left group">
                                    <p className="font-bold text-xs uppercase tracking-widest text-blue-100 mb-3">Download Templates</p>
                                    <div className="flex gap-2">
                                        <a
                                            href={`${api.BASE_URL}/courses/sample/csv?courseId=${courseId}`}
                                            download="questions_template.csv"
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-all"
                                        >
                                            <FileText size={14} className="text-white" />
                                            <span className="text-[10px] font-black text-white uppercase">CSV</span>
                                        </a>
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([JSON.stringify([{
                                                    courseId,
                                                    level: 1,
                                                    title: "Sample Question",
                                                    description: "Description here",
                                                    instructions: "Instructions here",
                                                    tags: ["HTML", "CSS"],
                                                    assets: { images: [], reference: "" },
                                                    expectedHtml: "<div></div>",
                                                    expectedCss: "",
                                                    expectedJs: ""
                                                }], null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'template.json';
                                                a.click();
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-all"
                                        >
                                            <FileCode size={14} className="text-white" />
                                            <span className="text-[10px] font-black text-white uppercase">JSON</span>
                                        </button>
                                    </div>
                                </div>
                                <button onClick={() => setShowImportModal(true)} className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl border border-white/10 transition-all text-left flex items-center justify-between group">
                                    <span className="font-bold text-sm">Import Questions</span>
                                    <Upload size={16} className="text-white/50 group-hover:text-white" />
                                </button>
                                {selectedQuestions.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={deleting}
                                        className="w-full bg-rose-500/90 hover:bg-rose-600 p-4 rounded-2xl border border-rose-400/30 transition-all text-left flex items-center justify-between group"
                                    >
                                        <span className="font-bold text-sm">
                                            {deleting ? 'Deleting...' : `Delete Selected (${selectedQuestions.length})`}
                                        </span>
                                        <Trash2 size={16} className="text-white/70 group-hover:text-white" />
                                    </button>
                                )}
                                <button
                                    onClick={handleFixAssets}
                                    disabled={fixingAssets}
                                    className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl border border-white/10 transition-all text-left flex items-center justify-between group"
                                >
                                    <span className="font-bold text-sm">
                                        {fixingAssets ? 'Fixing...' : 'Fix Assets'}
                                    </span>
                                    <Wrench size={16} className="text-white/50 group-hover:text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Questions List Area - Single Level View */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Always Render Level 1 Only */}
                        {[1].map((lv) => {
                            const questions = questionsByLevel[lv] || [];
                            const isExpanded = expandedLevels[lv];
                            const filtered = questions.filter(q =>
                                q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                q.description?.toLowerCase().includes(searchTerm.toLowerCase())
                            );

                            if (searchTerm && filtered.length === 0 && questions.length > 0) return null;

                            return (
                                <div key={lv} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                    <div
                                        onClick={() => toggleLevel(lv)}
                                        className="px-8 py-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 ${questions.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'} rounded-xl flex items-center justify-center font-black shadow-sm`}>
                                                {lv}
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`font-black ${questions.length > 0 ? 'text-slate-800' : 'text-slate-400'}`}>Level {lv} Questions</h3>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {questions.length > 0 ? `${questions.length} Questions Configured` : 'No questions yet'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {isExpanded ? <ChevronUp className="text-slate-300" size={20} /> : <ChevronDown className="text-slate-300" size={20} />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-4 space-y-3 bg-slate-50/30">
                                            {/* Select All header */}
                                            {questions.length > 0 && (
                                                <div className="flex items-center justify-between px-4 py-2 bg-white/50 rounded-xl border border-slate-100">
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={questions.length > 0 && questions.every(q => selectedQuestions.includes(q.id))}
                                                            onChange={() => toggleSelectAllInLevel(lv)}
                                                            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className="text-sm font-bold text-slate-600">
                                                            Select All ({questions.length})
                                                        </span>
                                                    </label>
                                                    {questions.filter(q => selectedQuestions.includes(q.id)).length > 0 && (
                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                            {questions.filter(q => selectedQuestions.includes(q.id)).length} selected
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {filtered.length > 0 ? filtered.map((q) => (
                                                <div
                                                    key={q.id}
                                                    className={`bg-white p-6 rounded-3xl border ${selectedQuestions.includes(q.id) ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'} hover:border-blue-300 transition-all group flex items-start justify-between gap-6 shadow-sm`}
                                                >
                                                    <div className="flex items-start gap-4 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedQuestions.includes(q.id)}
                                                            onChange={() => toggleSelectQuestion(q.id)}
                                                            className="mt-1.5 w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <div className="flex-1 space-y-3 text-left">
                                                            <div className="flex items-center gap-3">
                                                                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                                    Q{q.questionNumber || 'X'}
                                                                </span>
                                                                <h4 className="font-bold text-slate-900">{q.title}</h4>
                                                                {q.isLocked && <Lock size={14} className="text-amber-500" />}
                                                            </div>
                                                            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                                                {q.description}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Added by:</span>
                                                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/50">
                                                                    {q.creatorName || 'System'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(Array.isArray(q.tags) ? q.tags : []).map(tag => (
                                                                    <span key={tag} className="px-2.5 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            onClick={() => handleEdit(q)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-bold text-xs"
                                                        >
                                                            <Edit3 size={14} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(q.id)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all font-bold text-xs"
                                                        >
                                                            <Trash2 size={14} />
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-12 text-center text-slate-400 italic font-medium">
                                                    {questions.length === 0
                                                        ? 'No questions added to this level yet. Click "Add Question" to create one.'
                                                        : 'No questions found matching your search.'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Import Modal - Portal to document.body */}
                {showImportModal && createPortal(
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-black text-slate-900">Import Questions</h2>
                                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-blue-400 transition-colors">
                                <Upload className="mx-auto text-slate-300 mb-4" size={40} />
                                <input
                                    type="file"
                                    accept=".csv,.json"
                                    onChange={(e) => setImportFile(e.target.files[0])}
                                    className="hidden"
                                    id="import-file"
                                />
                                <label htmlFor="import-file" className="cursor-pointer text-blue-600 hover:text-blue-700 font-bold text-sm underline">
                                    {importFile ? importFile.name : 'Select a CSV or JSON file'}
                                </label>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Supported formats: CSV, JSON
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={!importFile || importing}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {importing ? 'Importing...' : 'Import'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}


            </div>
        </SaaSLayout>
    );
};

const RestrictionToggle = ({ title, description, icon, enabled, onChange }) => (
    <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all group">
        <div className="flex items-center gap-5 text-left">
            <div className="w-14 h-14 bg-slate-50 group-hover:bg-blue-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                {icon}
            </div>
            <div className="text-left">
                <p className="font-black text-slate-900 text-sm tracking-tight">{title}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{description}</p>
            </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled || false}
                onChange={(e) => onChange && onChange(e.target.checked)}
            />
            <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
        </label>
    </div>
);

export default QuestionBank;
