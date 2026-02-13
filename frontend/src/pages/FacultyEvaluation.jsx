import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PreviewFrame from '../components/PreviewFrame';
import ReadOnlyCodeBlock from '../components/ReadOnlyCodeBlock';
import TerminalPanel from '../components/TerminalPanel';
import { Terminal, Play, FileText, Code, Palette, File, ChevronRight, Activity, RefreshCw, FileCode, Info, FileInput, BookOpen } from 'lucide-react';

const FacultyEvaluation = () => {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('html');
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
                        className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary-600 transition-all bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:border-primary-200"
                    >
                        <span>&larr;</span>
                        BACK
                    </button>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                        <h1 className="text-sm font-display font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <span className="text-primary-600">eval:</span> {submission.candidate_name}
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
                {/* Left Panel: Telemetry (12%) */}
                <div className="w-[12%] bg-white border-r border-slate-200/50 overflow-y-auto p-5 scrollbar-hide">
                    <div className="mb-8">
                        <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                            <Activity size={10} />
                            TELEMETRY
                        </h3>
                        <div className="space-y-8">
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Outcome</p>
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-widest ${submission.status === 'passed'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    : 'bg-rose-50 text-rose-600 border-rose-100'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${submission.status === 'passed' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    {submission.status}
                                </div>
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Time</p>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-600 leading-tight">
                                        {new Date(submission.submitted_at).toLocaleDateString()}<br />
                                        <span className="text-slate-400 text-[9px] mt-1 block uppercase italic">{new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </p>
                                </div>
                            </div>
                            {data.studentFeedback && (
                                <div className="pt-8 border-t border-slate-100 space-y-6">
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Difficulty</p>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <div key={star} className={`w-1.5 h-1.5 rounded-full ${star <= data.studentFeedback.difficulty_rating ? 'bg-amber-400' : 'bg-slate-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Clarity</p>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <div key={star} className={`w-1.5 h-1.5 rounded-full ${star <= data.studentFeedback.clarity_rating ? 'bg-primary-500' : 'bg-slate-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Workspace (70%) */}
                <div className="flex-1 flex flex-col bg-[#f8fafc] relative overflow-hidden">
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

                            {/* Section: Preview */}
                            {[
                                { id: 'student_live', label: 'LIVE', icon: Play, color: 'text-emerald-500' },
                                { id: 'expected_live', label: 'REF', icon: BookOpen, color: 'text-blue-500' },
                                { id: 'compare', label: 'MATCH', icon: Activity, color: 'text-primary-500' }
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
                                                ? 'bg-slate-100 text-indigo-600 shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <FileText size={10} className="text-indigo-400" />
                                            <span>{name}</span>
                                        </button>
                                    ));
                                } catch (e) { return null; }
                            })()}

                            <div className="h-4 w-px bg-slate-200 mx-2" />

                            {/* Section: Output & Specs */}
                            {[
                                { id: 'terminal', label: 'TERMINAL', icon: Terminal, color: 'text-slate-500' },
                                { id: 'instructions', label: 'QUESTION', icon: Info, color: 'text-slate-400' }
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
                        {activeTab === 'compare' ? (
                            <div className="flex-1 flex flex-col md:flex-row gap-px bg-slate-200 overflow-hidden">
                                <div className="flex-1 bg-[#f8fafc] p-6 flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Candidate Output</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100">SCREENSHOT</span>
                                    </div>
                                    <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white group transition-all hover:border-blue-200">
                                        {(submission.user_screenshot || submission.id) ? (
                                            <img
                                                src={`${window.location.origin}/screenshots/${(submission.user_screenshot || `${submission.id}-candidate.png`).split('/').pop()}`}
                                                alt="User Screenshot"
                                                className="absolute inset-0 w-full h-full object-contain"
                                                onError={(e) => {
                                                    if (!e.target.src.includes('retry=1')) {
                                                        e.target.src += '?retry=1';
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] font-medium uppercase tracking-widest italic bg-slate-50">No screenshot captured</div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 bg-[#f8fafc] p-6 flex flex-col border-l border-slate-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Expected Result</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100">REFERENCE</span>
                                    </div>
                                    <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white group transition-all hover:border-emerald-200">
                                        {(submission.expected_screenshot || submission.id) ? (
                                            <img
                                                src={`${window.location.origin}/screenshots/${(submission.expected_screenshot || `${submission.id}-expected.png`).split('/').pop()}`}
                                                alt="Expected Solution"
                                                className="absolute inset-0 w-full h-full object-contain"
                                                onError={(e) => {
                                                    if (!e.target.src.includes('retry=1')) {
                                                        e.target.src += '?retry=1';
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] font-medium uppercase tracking-widest italic bg-slate-50">No reference image</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'terminal' ? (
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
                                            <FileCode size={14} className="text-indigo-600" />
                                        </div>
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 leading-none">
                                            {activeTab.replace('file_', '')}
                                        </h4>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest shadow-md shadow-indigo-500/10">
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
                                            <span>TECHNICAL SPECIFICATION</span>
                                        </div>

                                        <h3 className="text-3xl font-display font-black text-slate-900 tracking-tight leading-tight">
                                            {submission.challenge_title || "Engineering Assessment"}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-8">
                                            <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                                ID: {submission.challenge_id || 'SYS'}
                                            </div>
                                            <div className="px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-[8px] font-bold text-primary-600 uppercase tracking-widest">
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
                                <div className="absolute top-6 left-6 z-10 px-5 py-2.5 rounded-2xl bg-slate-900 shadow-2xl text-[10px] font-black text-white uppercase tracking-widest">
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
                                <div className="absolute top-6 left-6 z-10 px-5 py-2.5 rounded-2xl bg-blue-600 shadow-2xl text-[10px] font-black text-white uppercase tracking-widest">
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
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                <div className="flex-1 grid grid-cols-2 divide-x divide-slate-100 overflow-hidden">
                                    {/* Candidate Column */}
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200">
                                                    {activeTab === 'html' ? <Code size={14} className="text-orange-500" /> : activeTab === 'css' ? <Palette size={14} className="text-blue-500" /> : <FileText size={14} className="text-amber-500" />}
                                                </div>
                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 leading-none">
                                                    CANDIDATE {activeTab.toUpperCase()}
                                                </h4>
                                            </div>
                                            <div className="px-3 py-1 rounded-md bg-slate-100 text-slate-500 text-[8px] font-bold uppercase tracking-widest border border-slate-200">
                                                SUBMITTED SOURCE
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ReadOnlyCodeBlock
                                                code={activeTab === 'html' ? submission.html_code : activeTab === 'css' ? submission.css_code : submission.js_code}
                                                language={activeTab}
                                                height="100%"
                                            />
                                        </div>
                                    </div>

                                    {/* Reference Column */}
                                    <div className="flex flex-col h-full overflow-hidden bg-slate-50/5">
                                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-100/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                                                    <BookOpen size={14} className="text-primary-600" />
                                                </div>
                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 leading-none">
                                                    REFERENCE {activeTab.toUpperCase()}
                                                </h4>
                                            </div>
                                            <div className="px-3 py-1 rounded-md bg-primary-600 text-white text-[8px] font-bold uppercase tracking-widest shadow-lg shadow-primary-600/20">
                                                EXPECTED TARGET
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ReadOnlyCodeBlock
                                                code={activeTab === 'html' ? submission.expected_html : activeTab === 'css' ? submission.expected_css : submission.expected_js}
                                                language={activeTab}
                                                height="100%"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Scoring (18%) */}
                <div className="w-[18%] bg-white border-l border-slate-200/50 overflow-y-auto p-5 scrollbar-hide">
                    <div className="mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">RUBRIX</h3>
                    </div>
                    <div className="space-y-4">
                        {[
                            { id: 'codeQuality', label: 'Code Quality', max: 40 },
                            { id: 'requirements', label: 'Key Requirements', max: 25 },
                            { id: 'expectedOutput', label: 'Output', max: 35 }
                        ].map(pod => (
                            <div key={pod.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{pod.label}</label>
                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">MAX {pod.max}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number" min="0" max={pod.max}
                                        value={scores[pod.id]}
                                        onChange={e => setScores({ ...scores, [pod.id]: Math.min(pod.max, Math.max(0, parseInt(e.target.value) || 0)) })}
                                        className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-lg font-black text-primary-600 text-center focus:border-primary-400 outline-none transition-all tabular-nums"
                                    />
                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">PTS</span>
                                </div>
                            </div>
                        ))}
                        <div className="pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl text-white mb-6">
                                <div>
                                    <span className="text-[8px] font-bold uppercase text-slate-400">TOTAL</span>
                                    <h4 className="text-2xl font-black">{totalScore}</h4>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${totalScore >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                    {totalScore >= 80 ? 'PASS' : 'FAIL'}
                                </div>
                            </div>
                            <textarea
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs h-32 focus:bg-white outline-none transition-all resize-none placeholder-slate-300 text-slate-600 mb-6"
                                placeholder="Final remarks..."
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-4 bg-primary-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all disabled:opacity-50"
                            >
                                {submitting ? 'DEPLOYING...' : 'FINALIZE EVAL'}
                            </button>
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
                                    {fullScreenView === 'live' ? 'Candidate Review' : 'Reference Specs'}
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
