import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PreviewFrame from '../components/PreviewFrame';
import ReadOnlyCodeBlock from '../components/ReadOnlyCodeBlock';
import TerminalPanel from '../components/TerminalPanel';
import { Terminal, Play, FileText, Code, Palette, File, ChevronRight, Activity, RefreshCw, FileCode } from 'lucide-react';

const FacultyEvaluation = () => {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('html'); // 'html', 'css', 'js', 'student_live', 'expected_live', 'compare', 'instructions'
    const [isFullScreen, setIsFullScreen] = useState(false);

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
            additionalFiles = typeof submission.additional_files === 'string'
                ? JSON.parse(submission.additional_files || '{}')
                : (submission.additional_files || {});
        } catch (e) {
            console.error("Failed to parse additional files", e);
        }

        try {
            const response = await api.executeCode(submission.js_code, additionalFiles, 'nodejs', stdin);
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
            {/* Header: Lux Glassmorphism */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex justify-between items-center z-30 sticky top-0 shadow-sm">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/faculty/dashboard')}
                        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-600 transition-all font-inter"
                    >
                        <span className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-blue-200 group-hover:bg-blue-50 group-active:scale-90 transition-all shadow-sm">&larr;</span>
                        Back
                    </button>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <span className="text-blue-600">Evaluating:</span> {submission.candidate_name}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{submission.course_title}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[8px] font-black border border-blue-100 uppercase leading-none">Level {submission.level}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right border-r border-slate-200 pr-6">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Score Matrix</p>
                        <p className="text-xl font-black text-slate-900 tracking-tighter">{totalScore}<span className="text-slate-300">/100</span></p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border ${totalScore >= 80
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-500/10'
                        : 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm shadow-rose-500/10'
                        }`}>
                        {totalScore >= 80 ? 'PASSED' : 'FAILED'}
                    </div>
                </div>
            </header>

            <div className={`flex-1 flex overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50 bg-[#f8fafc]' : ''}`}>
                {/* Left Panel: Telemetry (15%) */}
                <div className={`${isFullScreen ? 'hidden' : 'w-[15%]'} bg-white border-r border-slate-200/60 overflow-y-auto p-6 scrollbar-hide`}>
                    <div className="mb-10">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-8 flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><Activity size={10} /></div>
                            TELEMETRY
                        </h3>

                        <div className="space-y-10">
                            <div className="relative">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-3">Submission Status</p>
                                <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-widest shadow-sm ${submission.status === 'passed'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${submission.status === 'passed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    {submission.status}
                                </div>
                                {(submission.status === 'error' || submission.status === 'pending') && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/evaluate', { submissionId });
                                                alert('Re-evaluation queued!');
                                                fetchSubmission();
                                            } catch (e) {
                                                alert('Failed to queue re-evaluation');
                                            }
                                        }}
                                        className="mt-4 block text-[9px] font-black text-blue-600 hover:underline uppercase tracking-widest transition-colors"
                                    >
                                        [ Trigger Re-eval ]
                                    </button>
                                )}
                            </div>

                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-3">Timestamp</p>
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-600 leading-tight">
                                        {new Date(submission.submitted_at).toLocaleDateString()}<br />
                                        <span className="text-slate-400 text-[9px] font-medium mt-1 block uppercase italic">{new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </p>
                                </div>
                            </div>

                            {data.studentFeedback && (
                                <div className="pt-10 border-t border-slate-100">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">STUDENT PULSE</h3>

                                    <div className="space-y-8">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-3">Difficulty Perception</p>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <div
                                                        key={star}
                                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${star <= data.studentFeedback.difficulty_rating
                                                            ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                                                            : 'bg-slate-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-3">Content Clarity</p>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <div
                                                        key={star}
                                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${star <= data.studentFeedback.clarity_rating
                                                            ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                                                            : 'bg-slate-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {data.studentFeedback.comments && (
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-3 px-1 text-left">Candidate Remarks</p>
                                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
                                                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                                        "{data.studentFeedback.comments}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Panel: Workspace (65%) */}
                <div className={`${isFullScreen ? 'w-full' : 'w-[65%]'} bg-white flex flex-col relative overflow-hidden`}>
                    <div className="flex bg-white border-b border-slate-200/80 items-center justify-between pr-4 sticky top-0 z-20 shadow-sm overflow-hidden h-14">
                        <div className="flex items-center overflow-x-auto scrollbar-hide h-full flex-1">
                            {/* Group: Core Files */}
                            <div className="flex items-center border-r border-slate-100 h-full">
                                {[
                                    { id: 'html', label: 'HTML', icon: Code, color: 'text-orange-600' },
                                    { id: 'css', label: 'CSS', icon: Palette, color: 'text-blue-600' },
                                    { id: 'js', label: 'JS', icon: FileText, color: 'text-amber-600' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-5 h-full flex items-center gap-2.5 text-[10px] font-black tracking-widest uppercase transition-all relative group/tab ${activeTab === tab.id
                                            ? 'text-slate-900 bg-slate-50/50'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/30'}`}
                                    >
                                        <tab.icon size={13} className={`${tab.color} ${activeTab === tab.id ? 'opacity-100 scale-110' : 'opacity-40 group-hover/tab:opacity-100 group-hover/tab:scale-105'} transition-all`} />
                                        <span>{tab.label}</span>
                                        {activeTab === tab.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-t-full shadow-[0_-4px_8px_rgba(37,99,235,0.2)]" />}
                                    </button>
                                ))}
                            </div>

                            {/* Group: Student's Custom Files */}
                            {(() => {
                                const rawFiles = submission.additional_files;
                                let files = {};
                                try {
                                    files = typeof rawFiles === 'string' ? JSON.parse(rawFiles || '{}') : (rawFiles || {});
                                } catch (e) {
                                    console.error("Parse additional files failed", e);
                                }
                                const fileKeys = Object.keys(files);

                                if (fileKeys.length === 0) return null;

                                return (
                                    <div className="flex items-center border-r border-slate-100 bg-slate-50/30 h-full">
                                        <div className="px-3 text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-r border-slate-100 h-full whitespace-nowrap bg-white/50">
                                            <ChevronRight size={10} className="text-slate-300" />
                                            <span>FILES</span>
                                        </div>
                                        {fileKeys.map(name => (
                                            <button
                                                key={`file_${name}`}
                                                onClick={() => setActiveTab(`file_${name}`)}
                                                className={`px-5 h-full flex items-center gap-2 text-[10px] font-black tracking-widest uppercase transition-all relative group/tab ${activeTab === `file_${name}`
                                                    ? 'text-indigo-600 bg-slate-50/50'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/30'}`}
                                            >
                                                <File size={12} className={`text-slate-400 ${activeTab === `file_${name}` ? 'text-indigo-500 scale-110' : 'opacity-60 scale-100 group-hover/tab:opacity-100 group-hover/tab:scale-105'} transition-all`} />
                                                <span className="max-w-[80px] truncate">{name}</span>
                                                {activeTab === `file_${name}` && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-t-full" />}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Group: Runtime & Specs */}
                            <div className="flex items-center h-full">
                                {[
                                    { id: 'terminal', label: 'Terminal', icon: Terminal, color: 'text-emerald-600' },
                                    { id: 'instructions', label: 'Brief', icon: Activity, color: 'text-indigo-500' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-5 h-full flex items-center gap-2.5 text-[10px] font-black tracking-widest uppercase transition-all relative group/tab ${activeTab === tab.id
                                            ? 'text-slate-900 bg-slate-50/50'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/30'}`}
                                    >
                                        <tab.icon size={13} className={`${tab.color} ${activeTab === tab.id ? 'opacity-100 scale-110' : 'opacity-40 group-hover/tab:opacity-100 group-hover/tab:scale-110'} transition-all`} />
                                        <span>{tab.label}</span>
                                        {activeTab === tab.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full" />}
                                    </button>
                                ))}

                                <div className="w-px h-6 bg-slate-200 mx-2" />

                                {[
                                    { id: 'student_live', label: 'Live' },
                                    { id: 'expected_live', label: 'Reference' },
                                    { id: 'compare', label: 'Compare' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 h-full flex items-center text-[9px] font-black tracking-widest uppercase transition-all relative ${activeTab === tab.id
                                            ? 'text-blue-600 bg-blue-50/30'
                                            : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {tab.label}
                                        {activeTab === tab.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500/40" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-white pl-4 relative z-10">
                            {activeTab === 'terminal' && (
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                    <button
                                        onClick={handleRunCode}
                                        disabled={evaluatingCode}
                                        className="relative flex items-center gap-2.5 px-6 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider transition-all hover:bg-emerald-500 hover:text-white hover:border-emerald-600 shadow-sm active:scale-95 disabled:opacity-50"
                                    >
                                        {evaluatingCode ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                            <Play size={12} fill="currentColor" stroke="none" />
                                        )}
                                        {evaluatingCode ? "EXECUTING" : "RUN NODE"}
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 hover:bg-white transition-all shadow-sm group"
                                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                            >
                                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isFullScreen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    )}
                                </svg>
                            </button>
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
                            <div className="flex-1 overflow-auto bg-[#f8fafc] scrollbar-hide">
                                <div className="max-w-4xl mx-auto p-10 md:p-14">
                                    {/* Question Header: Clinical Style */}
                                    <div className="bg-white rounded-[2.5rem] p-12 shadow-xl shadow-slate-200/40 border border-slate-100 mb-12 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />

                                        <div className="flex flex-wrap items-center justify-between gap-6 mb-10 relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                        ID: {submission.challenge_id || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100">
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                                        {submission.course_title} • Level {submission.level}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Active Record</span>
                                            </div>
                                        </div>

                                        <h3 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-8 tracking-tighter relative z-10">
                                            {submission.challenge_title || "Final Assessment"}
                                        </h3>
                                        <div className="h-2 w-24 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.2)]"></div>
                                    </div>

                                    {/* Question Content: Soft Documentation Pods */}
                                    <div className="space-y-12">
                                        {submission.challenge_description && (
                                            <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                                <h4 className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.3em] text-blue-600 mb-10">
                                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-serif text-2xl border border-blue-100">i</div>
                                                    Background
                                                </h4>
                                                <div className="text-slate-600 leading-[2.2] text-xl font-medium whitespace-pre-wrap">
                                                    {submission.challenge_description}
                                                </div>
                                            </section>
                                        )}

                                        <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                            <h4 className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-10">
                                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl border border-emerald-100">✓</div>
                                                Logic & Samples
                                            </h4>
                                            <div className="prose prose-slate max-w-none">
                                                <div className="text-slate-600 leading-[2.2] text-xl font-medium whitespace-pre-wrap">
                                                    {submission.challenge_instructions || "No instructions provided."}
                                                </div>
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
                                    code={{
                                        html: submission.html_code,
                                        css: submission.css_code,
                                        js: submission.js_code
                                    }}
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
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-200">
                                            <Code size={14} className="text-blue-600" />
                                        </div>
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 leading-none">
                                            {activeTab === 'html' ? 'HTML' : activeTab === 'css' ? 'CSS' : 'Javascript'}
                                        </h4>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest shadow-md shadow-blue-500/10">
                                        SOURCE
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
                        )}
                    </div>
                </div>

                {/* Right Panel: Scoring (20%) */}
                <div className={`${isFullScreen ? 'hidden' : 'w-[20%]'} bg-white border-l border-slate-200/60 overflow-y-auto p-6 scrollbar-hide`}>
                    <div className="mb-12">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-black text-2xl text-slate-900 tracking-tight">Rubrix</h3>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Scoring Cards: Lux Style */}
                        {[
                            { id: 'codeQuality', label: 'Code Quality (/40)', max: 40 },
                            { id: 'requirements', label: 'Key Requirements (/25)', max: 25 },
                            { id: 'expectedOutput', label: 'Output (/35)', max: 35 }
                        ].map(pod => (
                            <div key={pod.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/40 hover:-translate-y-1">
                                <div className="flex justify-between items-start mb-3">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em]">{pod.label}</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number" min="0" max={pod.max}
                                        value={scores[pod.id]}
                                        onChange={e => setScores({ ...scores, [pod.id]: Math.min(pod.max, Math.max(0, parseInt(e.target.value) || 0)) })}
                                        className="w-full h-10 px-4 bg-white border border-slate-200 rounded-xl text-lg font-black text-blue-600 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all placeholder-slate-300 shadow-sm"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="pt-10 mt-12 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-10 bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl shadow-slate-900/10">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Calculation</span>
                                    <h4 className="text-4xl font-black tracking-tighter mt-1">{totalScore}<span className="text-slate-600">/100</span></h4>
                                </div>
                                <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] ${totalScore >= 80
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-rose-500 text-white'
                                    }`}>
                                    {totalScore >= 80 ? 'PASSED' : 'FAILED'}
                                </div>
                            </div>

                            <div className="relative">
                                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1">Internal Evaluator Comments</label>
                                <textarea
                                    value={comments}
                                    onChange={e => setComments(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-[11px] h-40 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-300 outline-none transition-all resize-none mb-8 placeholder-slate-300 text-slate-600 font-medium leading-relaxed"
                                    placeholder="Provide detailed architectural feedback and improvement points..."
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="group relative w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] overflow-hidden transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {submitting ? 'COMMITTING CHANGES...' : 'Deploy Evaluation'}
                                    {!submitting && <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FacultyEvaluation;
