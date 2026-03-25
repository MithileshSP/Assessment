import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PreviewFrame from '../components/PreviewFrame';
import ReadOnlyCodeBlock from '../components/ReadOnlyCodeBlock';
import TerminalPanel from '../components/TerminalPanel';
import { Terminal, Play, FileText, Code, Palette, File, ChevronRight, Activity, RefreshCw, FileCode, Info, FileInput, BookOpen, MessageSquare, User } from 'lucide-react';

const FacultyEvaluation = () => {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('html');
    const [studentTab, setStudentTab] = useState('html');
    const [referenceTab, setReferenceTab] = useState('html');
    const [activeCustomFile, setActiveCustomFile] = useState(null);
    const [fullScreenView, setFullScreenView] = useState(null); // 'live' | 'expected' | null
    const [previewHistory, setPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
    const [fullPreviewHistory, setFullPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
    const previewRef = useRef(null);
    const fullPreviewRef = useRef(null);

    // Form State
    const [scores, setScores] = useState({
        codeQuality: 0,
        requirements: 0,
        expectedOutput: 0
    });
    const [comments, setComments] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Terminal State
    const [consoleOutput, setConsoleOutput] = useState([]);
    const [stdin, setStdin] = useState("");
    const [evaluatingCode, setEvaluatingCode] = useState(false);
    const [metrics, setMetrics] = useState(null);

    useEffect(() => {
        fetchSubmission();
    }, [submissionId]);

    const fetchSubmission = async () => {
        try {
            const res = await api.get(`/faculty/submission/${submissionId}`);
            setData(res.data);
            if (res.data.evaluation) {
                setScores({
                    codeQuality: res.data.evaluation.code_quality_score,
                    requirements: res.data.evaluation.requirements_score,
                    expectedOutput: res.data.evaluation.expected_output_score
                });
                setComments(res.data.evaluation.comments || '');
            }
        } catch (error) {
            console.error("Error loading submission", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await api.post('/faculty/evaluate', {
                submissionId,
                ...scores,
                comments
            });
            alert('Evaluation submitted successfully!');
            navigate('/faculty/dashboard');
        } catch (error) {
            alert('Failed to submit evaluation');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRunCode = async () => {
        setEvaluatingCode(true);
        setConsoleOutput([{ type: 'info', content: 'Running student code...' }]);
        setMetrics(null);

        // Prepare additional files from JSON if available
        let additionalFiles = {};
        try {
            additionalFiles = typeof data.submission.additional_files === 'string'
                ? JSON.parse(data.submission.additional_files || '{}')
                : (data.submission.additional_files || {});
        } catch (e) {
            console.error("Failed to parse additional files", e);
        }

        try {
            const response = await api.executeCode(data.submission.js_code, additionalFiles, 'nodejs', stdin);
            const { output, error, executionTime } = response.data;

            setMetrics({ executionTime, memoryUsage: '44.5 MB' });

            const newLogs = [];
            if (output) {
                output.split('\n').filter(l => l.trim() !== '').forEach(line => {
                    newLogs.push({ type: 'log', content: line });
                });
            }

            if (error) {
                error.split('\n').filter(l => l.trim() !== '').forEach(line => {
                    newLogs.push({ type: 'error', content: line });
                });
            }

            if (!output && !error) {
                newLogs.push({ type: 'info', content: 'Execution completed with no output.' });
            }

            setConsoleOutput(newLogs);
        } catch (err) {
            setConsoleOutput([{
                type: 'error',
                content: `Execution failed: ${err.response?.data?.error || err.message}`
            }]);
        } finally {
            setEvaluatingCode(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!data) return <div className="p-8 text-center text-red-600">Submission not found</div>;

    const { submission } = data;
    const totalScore = parseInt(scores.codeQuality) + parseInt(scores.requirements) + parseInt(scores.expectedOutput);

    return (
        <div className="h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-500/10">
            {/* Header: Minimal Pro */}
            <header className="bg-white border-b border-slate-200/50 px-6 py-3 flex justify-between items-center z-30 sticky top-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/faculty/dashboard')}
                        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-200"
                    >
                        <span>&larr;</span>
                        BACK
                    </button>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                        <h1 className="text-sm font-display font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <span className="text-blue-600">eval:</span> {submission.candidate_name}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{submission.course_title}</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[8px] font-black uppercase border border-slate-200">L{submission.level}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right border-r border-slate-200 pr-6">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Score</p>
                        <p className="text-xl font-display font-black text-slate-900 tabular-nums">{totalScore}<span className="text-slate-300 ml-0.5 text-xs">/100</span></p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${totalScore >= 80
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-rose-50 text-rose-600 border-rose-100'
                        }`}>
                        {totalScore >= 80 ? 'PASSED' : 'FAILED'}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">

                {/* Main Workspace (70%) */}
                <div className="flex-1 flex flex-col bg-[#f8fafc] relative overflow-hidden ml-6 border-l border-slate-200/50">
                    {/* Workspace Header: Minimal Unified */}
                    <div className="flex bg-white border-b border-slate-200/50 items-center justify-between px-4 sticky top-0 z-20 h-12">
                        <div className="flex items-center overflow-x-auto scrollbar-hide h-full flex-1 gap-1">
                            {/* Section: Code */}
                            {[
                                { id: 'html', label: 'HTML', icon: Code, color: 'text-orange-500' },
                                { id: 'css', label: 'CSS', icon: Palette, color: 'text-blue-500' },
                                { id: 'js', label: 'JS', icon: FileText, color: 'text-amber-500' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setStudentTab(tab.id);
                                        setReferenceTab(tab.id);
                                    }}
                                    className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all ${activeTab === tab.id
                                        ? 'bg-slate-100 text-slate-900 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <tab.icon size={10} className={tab.color} />
                                    <span>{tab.label}</span>
                                </button>
                            ))}

                            <div className="h-4 w-px bg-slate-200 mx-2" />

                            {[
                                { id: 'student_live', label: 'LIVE', icon: Play, color: 'text-emerald-500' },
                                { id: 'expected_live', label: 'REF', icon: BookOpen, color: 'text-blue-500' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all ${activeTab === tab.id
                                        ? 'bg-slate-100 text-slate-900 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <tab.icon size={10} className={tab.color} />
                                    <span>{tab.label}</span>
                                </button>
                            ))}

                            <div className="h-4 w-px bg-slate-200 mx-2" />

                            {/* Section: Custom Files (Dynamically Loaded) */}
                            {(() => {
                                try {
                                    const rawFiles = submission.additional_files;
                                    const files = typeof rawFiles === 'string' ? JSON.parse(rawFiles || '{}') : (rawFiles || {});
                                    const fileKeys = Object.keys(files);

                                    return fileKeys.map(name => (
                                        <button
                                            key={`custom_${name}`}
                                            onClick={() => { setActiveTab(`file_${name}`); setActiveCustomFile(name); }}
                                            className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all ${activeTab === `file_${name}`
                                                ? 'bg-slate-100 text-blue-600 shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <FileText size={10} className="text-blue-400" />
                                            <span>{name}</span>
                                        </button>
                                    ));
                                } catch (e) { return null; }
                            })()}

                            <div className="h-4 w-px bg-slate-200 mx-2" />

                            {/* Section: Output & Specs */}
                            {[
                                { id: 'terminal', label: 'TERMINAL', icon: Terminal, color: 'text-slate-500' },
                                { id: 'instructions', label: 'QUESTION', icon: Info, color: 'text-slate-400' },
                                { id: 'feedback', label: 'FEEDBACK', icon: MessageSquare, color: 'text-indigo-400' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all ${activeTab === tab.id
                                        ? 'bg-slate-100 text-slate-900 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <tab.icon size={10} className={tab.color} />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                            {activeTab === 'terminal' && (
                                <button
                                    onClick={handleRunCode}
                                    disabled={evaluatingCode}
                                    className="h-8 px-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {evaluatingCode ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
                                    {evaluatingCode ? "RUNNING" : "EXECUTE"}
                                </button>
                            )}
                            {(activeTab === 'student_live' || activeTab === 'expected_live') && (
                                <button
                                    onClick={() => setFullScreenView(activeTab === 'student_live' ? 'live' : 'expected')}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                                    title="Fullscreen"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden bg-[#0f172a] flex flex-col">
                        {activeTab === 'terminal' ? (
                            <div className="flex-1 overflow-hidden p-8 bg-slate-50">
                                <TerminalPanel
                                    output={consoleOutput}
                                    onClear={() => setConsoleOutput([])}
                                    stdin={stdin}
                                    setStdin={setStdin}
                                    metrics={metrics}
                                    isExpanded={true}
                                />
                            </div>
                        ) : activeTab.startsWith('file_') ? (
                            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-200">
                                            <FileCode size={14} className="text-blue-600" />
                                        </div>
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 leading-none">
                                            {activeTab.replace('file_', '')}
                                        </h4>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest shadow-md shadow-blue-500/10">
                                        SOURCE
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <ReadOnlyCodeBlock
                                        code={(() => {
                                            const files = typeof submission.additional_files === 'string'
                                                ? JSON.parse(submission.additional_files || '{}')
                                                : (submission.additional_files || {});
                                            return files[activeTab.replace('file_', '')] || '';
                                        })()}
                                        language={activeTab.split('.').pop() === 'txt' ? 'plaintext' : 'javascript'}
                                        height="100%"
                                    />
                                </div>
                            </div>
                        ) : activeTab === 'instructions' ? (
                            <div className="flex-1 overflow-auto bg-[#f8fafc] p-10 scrollbar-hide">
                                <div className="max-w-4xl mx-auto space-y-10">
                                    {/* Question Header: Professional Minimal */}
                                    <div className="bg-white rounded-2xl p-10 border border-slate-200">
                                        <div className="flex items-center gap-2 mb-6 uppercase tracking-widest font-black text-[8px] text-slate-400">
                                            <Info size={10} />
                                            <span>TECHNICAL QUESTION</span>
                                        </div>

                                        <h3 className="text-3xl font-display font-black text-slate-900 tracking-tight leading-tight">
                                            {submission.challenge_title || "Engineering Assessment"}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-8">
                                            <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                                ID: {submission.challenge_id || 'SYS'}
                                            </div>
                                            <div className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[8px] font-black text-blue-600 uppercase tracking-widest">
                                                {submission.course_title}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project Content */}
                                    <div className="space-y-10 bg-white rounded-2xl p-10 border border-slate-200">
                                        {submission.challenge_description && (
                                            <section>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-4 mb-6">
                                                    01. Project Scope
                                                </h4>
                                                <div className="text-slate-600 leading-relaxed text-[15px] whitespace-pre-wrap font-medium">
                                                    {submission.challenge_description}
                                                </div>
                                            </section>
                                        )}

                                        <section>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-4 mb-6">
                                                02. Functional Requirements
                                            </h4>
                                            <div className="text-slate-600 leading-relaxed text-[15px] whitespace-pre-wrap font-medium">
                                                {submission.challenge_instructions || "Standard technical requirements apply for this level."}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'student_live' ? (
                            <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
                                <div className="absolute bottom-6 right-6 z-10 px-5 py-2.5 rounded-2xl bg-slate-900 shadow-2xl text-[10px] font-black text-white uppercase tracking-widest">
                                    Candidate Preview
                                </div>
                                <PreviewFrame
                                    ref={previewRef}
                                    code={{
                                        html: submission.html_code,
                                        css: submission.css_code,
                                        js: submission.js_code,
                                        additionalFiles: typeof submission.additional_files === 'string' ? JSON.parse(submission.additional_files || '{}') : (submission.additional_files || {})
                                    }}
                                    onHistoryChange={setPreviewHistory}
                                />
                            </div>
                        ) : activeTab === 'expected_live' ? (
                            <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
                                <div className="absolute bottom-6 right-6 z-10 px-5 py-2.5 rounded-2xl bg-blue-600 shadow-2xl text-[10px] font-black text-white uppercase tracking-widest">
                                    Reference System
                                </div>
                                <PreviewFrame
                                    code={{
                                        html: submission.expected_html,
                                        css: submission.expected_css,
                                        js: submission.expected_js
                                    }}
                                />
                            </div>
                        ) : activeTab === 'feedback' ? (
                            <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
                                <div className="max-w-4xl mx-auto space-y-6 text-left">
                                    <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
                                            <User size={12} className="text-indigo-500" />
                                            Student Experience Feedback
                                        </h3>
                                        {data.studentFeedback ? (
                                            <div className="space-y-8">
                                                <div className="flex items-center gap-6">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Rating</p>
                                                        <div className="flex gap-1.5">
                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                <div key={star} className={`w-5 h-5 rounded-full ${star <= data.studentFeedback.rating ? 'bg-amber-400 shadow-md shadow-amber-400/20' : 'bg-slate-200'}`} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-8 bg-indigo-50/30 rounded-2xl border border-indigo-100 text-left">
                                                    <p className="text-slate-700 text-lg leading-relaxed italic font-medium">
                                                        "{data.studentFeedback.comments || 'No specific comments provided.'}"
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                <MessageSquare size={24} className="mx-auto text-slate-200 mb-4" />
                                                <p className="text-slate-400 font-medium italic text-sm">
                                                    No student feedback has been submitted yet for this level.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                <div className="flex-1 grid grid-cols-2 divide-x divide-slate-100 overflow-hidden">
                                    {/* Candidate Column */}
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200">
                                                    {studentTab === 'html' ? <Code size={14} className="text-orange-500" /> : studentTab === 'css' ? <Palette size={14} className="text-blue-500" /> : <FileText size={14} className="text-amber-500" />}
                                                </div>
                                                <div className="flex items-center gap-1.5 p-1 bg-white/50 rounded-lg border border-slate-200 shadow-sm">
                                                    {['html', 'css', 'js'].map(lang => (
                                                        <button
                                                            key={lang}
                                                            onClick={() => setStudentTab(lang)}
                                                            className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter transition-all ${studentTab === lang ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {lang}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="px-3 py-1 rounded-md bg-slate-100 text-slate-500 text-[8px] font-bold uppercase tracking-widest border border-slate-200">
                                                CANDIDATE SOURCE
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ReadOnlyCodeBlock
                                                code={studentTab === 'html' ? submission.html_code : studentTab === 'css' ? submission.css_code : submission.js_code}
                                                language={studentTab}
                                                height="100%"
                                            />
                                        </div>
                                    </div>

                                    {/* Reference Column */}
                                    <div className="flex flex-col h-full overflow-hidden bg-slate-50/5">
                                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-100/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                                                    {referenceTab === 'html' ? <Code size={14} className="text-orange-500" /> : referenceTab === 'css' ? <Palette size={14} className="text-blue-500" /> : <FileText size={14} className="text-amber-500" />}
                                                </div>
                                                <div className="flex items-center gap-1.5 p-1 bg-white/50 rounded-lg border border-slate-200 shadow-sm">
                                                    {['html', 'css', 'js'].map(lang => (
                                                        <button
                                                            key={lang}
                                                            onClick={() => setReferenceTab(lang)}
                                                            className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter transition-all ${referenceTab === lang ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {lang}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="px-3 py-1 rounded-md bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
                                                REFERENCE TARGET
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ReadOnlyCodeBlock
                                                code={referenceTab === 'html' ? submission.expected_html : referenceTab === 'css' ? submission.expected_css : submission.expected_js}
                                                language={referenceTab}
                                                height="100%"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Scoring (280px for consistency) */}
                <div className="w-[280px] bg-white border-l border-slate-200 overflow-y-auto p-5 shrink-0 flex flex-col scrollbar-hide">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
                        <Activity size={14} className="text-blue-500" />
                        Score Breakdown
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase w-20 text-left">Quality</span>
                                <input
                                    type="number"
                                    value={scores.codeQuality}
                                    onChange={e => setScores({ ...scores, codeQuality: Math.min(40, Math.max(0, parseInt(e.target.value) || 0)) })}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none text-right font-bold text-blue-600"
                                    min="0" max="40"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase w-20 text-left">Reqs</span>
                                <input
                                    type="number"
                                    value={scores.requirements}
                                    onChange={e => setScores({ ...scores, requirements: Math.min(25, Math.max(0, parseInt(e.target.value) || 0)) })}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none text-right font-bold text-blue-600"
                                    min="0" max="25"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase w-20 text-left">Output</span>
                                <input
                                    type="number"
                                    value={scores.expectedOutput}
                                    onChange={e => setScores({ ...scores, expectedOutput: Math.min(35, Math.max(0, parseInt(e.target.value) || 0)) })}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none text-right font-bold text-blue-600"
                                    min="0" max="35"
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center px-1 border-y border-slate-100 py-3 mt-4">
                            <span className="text-[10px] font-bold text-slate-900 uppercase">Total Score</span>
                            <span className="text-base font-black text-blue-600">{totalScore}%</span>
                        </div>

                        <div className={`p-4 rounded-xl flex items-center justify-between ${totalScore >= 80 ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                            <span className={`text-xs font-black uppercase tracking-widest ${totalScore >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {totalScore >= 80 ? 'PASSED' : 'FAILED'}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${totalScore >= 80 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                        </div>

                        <div className="space-y-2 mt-6">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Observer Comments</label>
                            <textarea
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs h-32 focus:bg-white outline-none transition-all resize-none text-slate-600 placeholder-slate-300"
                                placeholder="Technical observations..."
                            />
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
                        >
                            {submitting ? 'DEPLOYING...' : 'FINALIZE EVALUATION'}
                        </button>

                        <div className="pt-8 border-t border-slate-100 mt-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Payload Size</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">HTML</span>
                                    <span className="text-[10px] font-mono text-slate-700">{(submission.html_code || '').length} B</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">CSS</span>
                                    <span className="text-[10px] font-mono text-slate-700">{(submission.css_code || '').length} B</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">JS</span>
                                    <span className="text-[10px] font-mono text-slate-700">{(submission.js_code || '').length} B</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fullscreen Modal: Mirroring LevelChallenge.jsx */}
            {fullScreenView && (
                <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col backdrop-blur-sm">
                    {/* Header */}
                    <div className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${fullScreenView === 'live' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
                                <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
                                    {fullScreenView === 'live' ? 'Candidate Review' : 'Reference Question'}
                                </span>
                            </div>
                            <div className="h-4 w-px bg-white/10" />
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white/90 tracking-tight">{submission.candidate_name}</span>
                                <span className="text-[10px] text-white/40 font-medium">@{submission.course_title}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setFullScreenView(null)}
                            className="w-8 h-8 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-rose-500 flex items-center justify-center transition-all group active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Navigation Controls Overlay - Top Left */}
                    <div className="fixed top-1 left-4 z-[110] translate-y-20 flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 backdrop-blur-md shadow-lg scale-90 origin-top-left transition-all hover:scale-100">
                        <button
                            disabled={!fullPreviewHistory.canGoBack}
                            onClick={() => fullPreviewRef.current?.goBack()}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fullPreviewHistory.canGoBack ? 'text-white hover:bg-white/10 active:scale-95' : 'text-white/20 cursor-not-allowed'}`}
                        >
                            <ChevronRight size={18} className="rotate-180" />
                        </button>
                        <button
                            disabled={!fullPreviewHistory.canGoForward}
                            onClick={() => fullPreviewRef.current?.goForward()}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fullPreviewHistory.canGoForward ? 'text-white hover:bg-white/10 active:scale-95' : 'text-white/20 cursor-not-allowed'}`}
                        >
                            <ChevronRight size={18} />
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <div className="px-2 py-1 flex items-center gap-2">
                            <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter">PAGE</span>
                            <span className="text-[10px] font-bold text-white/90 truncate max-w-[120px]">{fullPreviewHistory.currentFile}</span>
                        </div>
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 bg-white overflow-hidden relative">
                        {fullScreenView === 'live' ? (
                            <PreviewFrame
                                ref={fullPreviewRef}
                                code={{
                                    html: submission.html_code,
                                    css: submission.css_code,
                                    js: submission.js_code,
                                    additionalFiles: typeof submission.additional_files === 'string' ? JSON.parse(submission.additional_files || '{}') : (submission.additional_files || {})
                                }}
                                initialFile={previewHistory.currentFile}
                                onHistoryChange={setFullPreviewHistory}
                            />
                        ) : (
                            <PreviewFrame
                                code={{
                                    html: submission.expected_html,
                                    css: submission.expected_css,
                                    js: submission.expected_js
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacultyEvaluation;
