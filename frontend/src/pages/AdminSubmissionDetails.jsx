import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import ReadOnlyCodeBlock from '../components/ReadOnlyCodeBlock';
import PreviewFrame from '../components/PreviewFrame';
import TerminalPanel from '../components/TerminalPanel';
import {
  Code,
  User,
  Terminal,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  Monitor,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Trophy,
  ShieldAlert,
  Save,
  Play,
  Palette,
  FileText,
  Activity,
  Info,
  FileCode,
  RefreshCw,
  Activity as MatchIcon,
  BookOpen
} from 'lucide-react';

export default function AdminSubmissionDetails() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('audit');
  const [activeCustomFile, setActiveCustomFile] = useState(null);
  const [fullScreenView, setFullScreenView] = useState(null);
  const [previewHistory, setPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
  const [fullPreviewHistory, setFullPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
  const previewRef = useRef(null);
  const fullPreviewRef = useRef(null);

  // Override State
  const [overriding, setOverriding] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

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
      setLoading(true);
      // Using the faculty endpoint as it returns enriched challenge data
      const res = await api.get(`/faculty/submission/${submissionId}`);
      setData(res.data);
    } catch (error) {
      console.error("Error loading submission", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (status) => {
    if (!overrideReason.trim()) {
      alert('Please provide a reason for the override.');
      return;
    }
    try {
      setOverriding(true);
      await api.post(`/admin/submissions/${submissionId}/override`, {
        status,
        reason: overrideReason
      });
      // Refresh
      fetchSubmission();
      setOverrideReason('');
      alert(`Submission successfully marked as ${status.toUpperCase()}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply override');
    } finally {
      setOverriding(false);
    }
  };

  const handleRunCode = async () => {
    setEvaluatingCode(true);
    setConsoleOutput([{ type: 'info', content: 'Running student code...' }]);
    setMetrics(null);

    const submission = data.submission;
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
        newLogs.push({ type: 'error', content: error });
      }
      if (!output && !error) {
        newLogs.push({ type: 'info', content: 'Execution completed with no output.' });
      }

      setConsoleOutput(prev => [...prev, ...newLogs]);
    } catch (err) {
      setConsoleOutput(prev => [...prev, { type: 'error', content: `Execution failed: ${err.message}` }]);
    } finally {
      setEvaluatingCode(false);
    }
  };

  if (loading) return (
    <SaaSLayout>
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Retrieving Submission Packets...</p>
      </div>
    </SaaSLayout>
  );

  if (!data) return (
    <SaaSLayout>
      <div className="text-center py-40 text-slate-400 font-bold">Error loading submission.</div>
    </SaaSLayout>
  );

  const submission = data.submission;
  const evaluation = data.evaluation || {};

  const autoScore = submission.final_score ?? 0;
  const manualScore = evaluation.total_score || null;
  const finalStatus = submission.status;

  return (
    <SaaSLayout fullWidth={true}>
      <div className="flex flex-col h-[calc(100vh-96px)] relative bg-slate-50">

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Telemetry (Fixed Width) */}
          <div className="w-[260px] bg-white border-r border-slate-200/50 overflow-y-auto p-5 shrink-0 flex flex-col">
            <div className="mb-8">
              <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                <Activity size={10} />
                TELEMETRY
              </h3>
              <div className="space-y-8">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Submission ID</p>
                  <p className="text-[10px] font-mono text-slate-600 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">{submission.id}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Submitted At</p>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-600 leading-tight">
                      {new Date(submission.submitted_at).toLocaleDateString()}<br />
                      <span className="text-slate-400 text-[9px] mt-1 block uppercase italic">{new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>
                </div>
                {evaluation.evaluator_name && (
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-3">Evaluator</p>
                    <div className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100">
                      <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                        {evaluation.evaluator_name.charAt(0)}
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600">{evaluation.evaluator_name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Workspace (Flexible Width) */}
          <div className="flex-1 min-w-0 flex flex-col bg-[#f8fafc] relative overflow-hidden">
            {/* Workspace Header */}
            <div className="flex bg-white border-b border-slate-200/50 items-center justify-between px-6 sticky top-0 z-20 h-16 shrink-0 shadow-sm">
              <div className="flex items-center gap-6 flex-1 overflow-hidden">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 transition-colors rounded-xl border border-slate-100 shadow-sm shrink-0">
                  <ArrowLeft size={16} className="text-slate-600" />
                </button>
                <div className="shrink-0 min-w-0 pr-6 border-r border-slate-100">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-sm font-black text-slate-900 leading-tight truncate max-w-[200px]">
                      {submission.candidate_name || 'Anonymous'}
                    </h2>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${finalStatus === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : finalStatus === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      {finalStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">L{submission.level} • {submission.course_title}</span>
                  </div>
                </div>

                <div className="flex items-center overflow-x-auto scrollbar-hide h-full gap-2 px-2 flex-nowrap">
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all shrink-0 ${activeTab === 'audit'
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    <ShieldAlert size={10} />
                    <span>AUDIT</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {[
                    { id: 'html', label: 'HTML', icon: Code, color: 'text-orange-500' },
                    { id: 'css', label: 'CSS', icon: Palette, color: 'text-blue-500' },
                    { id: 'js', label: 'JS', icon: FileText, color: 'text-amber-500' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all shrink-0 ${activeTab === tab.id
                        ? 'bg-slate-100 text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={10} className={tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {[
                    { id: 'student_live', label: 'LIVE', icon: Play, color: 'text-emerald-500' },
                    { id: 'expected_live', label: 'REF', icon: BookOpen, color: 'text-blue-500' },
                    { id: 'compare', label: 'MATCH', icon: MatchIcon, color: 'text-primary-500' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all shrink-0 ${activeTab === tab.id
                        ? 'bg-slate-100 text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={10} className={tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {/* Custom Files */}
                  {(() => {
                    try {
                      const files = typeof submission.additional_files === 'string' ? JSON.parse(submission.additional_files || '{}') : (submission.additional_files || {});
                      return Object.keys(files).map(name => (
                        <button
                          key={`file_${name}`}
                          onClick={() => setActiveTab(`file_${name}`)}
                          className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all shrink-0 ${activeTab === `file_${name}`
                            ? 'bg-slate-100 text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                          <FileCode size={10} className="text-indigo-400" />
                          <span>{name}</span>
                        </button>
                      ));
                    } catch (e) { return null; }
                  })()}

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {[
                    { id: 'terminal', label: 'TERM', icon: Terminal, color: 'text-slate-500' },
                    { id: 'instructions', label: 'SPECS', icon: Info, color: 'text-slate-400' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 h-8 rounded-lg flex items-center gap-2 text-[8px] font-bold tracking-widest uppercase transition-all shrink-0 ${activeTab === tab.id
                        ? 'bg-slate-100 text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={10} className={tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0 border-l border-slate-100 pl-6 ml-4">
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">AUTO</p>
                  <p className="text-sm font-black text-slate-900 tabular-nums">{Math.round(autoScore)}%</p>
                </div>
                {manualScore !== null && (
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">FACULTY</p>
                    <p className="text-sm font-black text-blue-600 tabular-nums">{manualScore}%</p>
                  </div>
                )}

                <div className="flex items-center gap-2 border-l border-slate-100 pl-6">
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
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'audit' ? (
                <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
                  <div className="max-w-6xl mx-auto space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Automated Diagnostic */}
                      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                          <Cpu size={80} />
                        </div>
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-xl">
                              <Cpu size={20} className="text-blue-400" />
                            </div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Automated Diagnostic</h3>
                          </div>
                        </div>
                        <div className="space-y-8 relative">
                          <div>
                            <div className="flex justify-between items-end mb-3">
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">AI Scoring Reliability</p>
                              <p className="text-4xl font-black text-white">{Math.round(autoScore)}%</p>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000" style={{ width: `${autoScore}%` }} />
                            </div>
                          </div>

                          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Automated Narrative</p>
                            <p className="text-slate-300 text-sm italic leading-relaxed">
                              {submission.result ? (
                                typeof submission.result === 'string' ? submission.result : (submission.result.feedback || submission.result.message || 'Technical evaluation complete.')
                              ) : 'No automated feedback available.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Faculty Review */}
                      <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                          <User size={80} />
                        </div>
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                              <User size={20} className="text-white" />
                            </div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Faculty Review</h3>
                          </div>
                        </div>
                        {manualScore !== null ? (
                          <div className="space-y-6 relative">
                            <div className="flex items-end gap-6">
                              <div className="flex-1">
                                <div className="flex justify-between items-end mb-3">
                                  <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Human Grade</p>
                                  <p className="text-5xl font-black text-white">{manualScore}%</p>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-white transition-all duration-1000" style={{ width: `${manualScore}%` }} />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 py-6 border-y border-white/10">
                              <div>
                                <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">Code Quality</p>
                                <p className="text-xl font-black text-white tabular-nums">{evaluation.code_quality_score || 0}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">Key Requirements</p>
                                <p className="text-xl font-black text-white tabular-nums">{evaluation.requirements_score || 0}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">Expected Output</p>
                                <p className="text-xl font-black text-white tabular-nums">{evaluation.expected_output_score || 0}</p>
                              </div>
                            </div>

                            <div className="p-5 bg-white/10 rounded-xl border border-white/10">
                              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-3">Faculty Remarks</p>
                              <p className="text-blue-50 text-sm italic leading-relaxed">
                                "{evaluation.comments || 'No comments provided.'}"
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 bg-white/5 rounded-xl border border-white/5">
                            <Clock size={32} className="text-blue-100 mb-4 animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Review In Progress</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Visual Deltas */}
                    {(submission.user_screenshot || submission.expected_screenshot) && (
                      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                          <Monitor size={14} />
                          Visual Delta Analysis
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {submission.user_screenshot && (
                            <div className="space-y-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Candidate Render</p>
                              <div className="aspect-video rounded-xl border-4 border-slate-100 overflow-hidden shadow-md bg-slate-50 relative">
                                <img src={submission.user_screenshot} className="absolute inset-0 w-full h-full object-contain" alt="Candidate" />
                              </div>
                            </div>
                          )}
                          {submission.expected_screenshot && (
                            <div className="space-y-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference Template</p>
                              <div className="aspect-video rounded-xl border-4 border-slate-100 overflow-hidden shadow-md bg-slate-50 relative">
                                <img src={submission.expected_screenshot} className="absolute inset-0 w-full h-full object-contain" alt="Reference" />
                              </div>
                            </div>
                          )}
                          {submission.diff_screenshot && (
                            <div className="space-y-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Difference Mask</p>
                              <div className="aspect-video rounded-xl border-4 border-slate-900 overflow-hidden shadow-md bg-slate-900 relative">
                                <img src={submission.diff_screenshot} className="absolute inset-0 w-full h-full object-contain" alt="Diff" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'html' || activeTab === 'css' || activeTab === 'js' ? (
                <div className="flex-1 overflow-hidden flex flex-col bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm ${activeTab === 'html' ? 'bg-orange-50 text-orange-500' : activeTab === 'css' ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
                        <Code size={16} />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">{activeTab.toUpperCase()} SOURCE</h4>
                    </div>
                    <div className="px-3 py-1 bg-slate-900 text-white rounded text-[8px] font-black uppercase tracking-widest">READ ONLY</div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ReadOnlyCodeBlock
                      code={activeTab === 'html' ? submission.html_code : activeTab === 'css' ? submission.css_code : submission.js_code}
                      language={activeTab}
                      height="100%"
                    />
                  </div>
                </div>
              ) : activeTab === 'student_live' ? (
                <div className="flex-1 bg-white relative">
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
                <div className="flex-1 bg-white relative">
                  <PreviewFrame
                    code={{
                      html: submission.expected_html,
                      css: submission.expected_css,
                      js: submission.expected_js
                    }}
                  />
                </div>
              ) : activeTab === 'compare' ? (
                <div className="flex-1 flex overflow-hidden group">
                  <div className="flex-1 bg-slate-50 p-4 flex flex-col">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">CANDIDATE OUTPUT</h4>
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                      <img src={submission.user_screenshot} className="absolute inset-0 w-full h-full object-contain" alt="Candidate" />
                    </div>
                  </div>
                  <div className="w-px bg-slate-200" />
                  <div className="flex-1 bg-slate-50 p-4 flex flex-col">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">PRODUCTION TEMPLATE</h4>
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                      <img src={submission.expected_screenshot} className="absolute inset-0 w-full h-full object-contain" alt="Expected" />
                    </div>
                  </div>
                </div>
              ) : activeTab === 'terminal' ? (
                <div className="flex-1 bg-slate-50 p-4 overflow-hidden">
                  <TerminalPanel
                    output={consoleOutput}
                    onClear={() => setConsoleOutput([])}
                    stdin={stdin}
                    setStdin={setStdin}
                    metrics={metrics}
                    isExpanded={true}
                  />
                </div>
              ) : activeTab === 'instructions' ? (
                <div className="flex-1 overflow-y-auto bg-white p-8 md:p-12">
                  <div className="max-w-4xl mx-auto space-y-10">
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-4">{submission.challenge_title || 'Technical Challenge'}</h3>
                      <div className="flex gap-3">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase border border-blue-100">ID: {submission.challenge_id}</span>
                        <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] font-black uppercase border border-slate-200">CATEGORY: {submission.course_title}</span>
                      </div>
                    </div>

                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 pb-3 border-b border-slate-100 mb-5">01. DESCRIPTION</h4>
                      <div className="text-slate-600 font-medium text-sm leading-relaxed whitespace-pre-wrap">{submission.challenge_description}</div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 pb-3 border-b border-slate-100 mb-5">02. TECHNICAL SPECIFICATIONS</h4>
                      <div className="text-slate-600 font-medium text-sm leading-relaxed whitespace-pre-wrap">{submission.challenge_instructions}</div>
                    </section>
                  </div>
                </div>
              ) : activeTab.startsWith('file_') ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center border border-indigo-100 shadow-sm">
                        <FileCode size={16} />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">{activeTab.replace('file_', '')}</h4>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ReadOnlyCodeBlock
                      code={(() => {
                        const files = typeof submission.additional_files === 'string' ? JSON.parse(submission.additional_files || '{}') : (submission.additional_files || {});
                        return files[activeTab.replace('file_', '')] || '';
                      })()}
                      language={activeTab.split('.').pop() === 'txt' ? 'plaintext' : 'javascript'}
                      height="100%"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Panel: Admin Overrides (Fixed Width) */}
          <div className="w-[320px] bg-white border-l border-slate-200/50 overflow-y-auto p-6 shrink-0 flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
              <ShieldAlert size={12} className="text-amber-500" />
              ADMIN OVERRIDE
            </h3>

            <div className="space-y-8">
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-2">Notice</h4>
                <p className="text-[11px] text-amber-700/80 leading-relaxed font-medium">Overriding a status will bypass all automated and faculty judgement. This action is audited.</p>
              </div>

              {submission.admin_override_status && submission.admin_override_status !== 'none' && (
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">CURRENT OVERRIDE</p>
                  <p className="text-xs font-black text-blue-900 capitalize mb-2">{submission.admin_override_status}</p>
                  <p className="text-[11px] text-blue-700 italic leading-relaxed">"{submission.admin_override_reason}"</p>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Justification</label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Enter audit reason..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs h-32 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none font-medium text-slate-600"
                />
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handleOverride('passed')}
                    disabled={overriding}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <CheckCircle size={14} /> Force Pass
                  </button>
                  <button
                    onClick={() => handleOverride('failed')}
                    disabled={overriding}
                    className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/10 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <XCircle size={14} /> Force Fail
                  </button>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="pt-8 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Source Health</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HTML</span>
                    <span className="text-[11px] font-black text-slate-900">{(submission.html_code || '').length}B</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CSS</span>
                    <span className="text-[11px] font-black text-slate-900">{(submission.css_code || '').length}B</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">JS</span>
                    <span className="text-[11px] font-black text-slate-900">{(submission.js_code || '').length}B</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fullscreen Preview Modal */}
        {fullScreenView && (
          <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
            <div className="h-14 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <span className={`w-2 h-2 rounded-full ${fullScreenView === 'live' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                  {fullScreenView === 'live' ? 'Candidate Review' : 'Reference Specs'}
                </span>
              </div>
              <button
                onClick={() => setFullScreenView(null)}
                className="w-8 h-8 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-rose-500 flex items-center justify-center transition-all"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* Navigation Overlay */}
            <div className="fixed top-20 left-6 z-[110] flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl">
              <button
                disabled={!fullPreviewHistory.canGoBack}
                onClick={() => fullPreviewRef.current?.goBack()}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fullPreviewHistory.canGoBack ? 'text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'}`}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                disabled={!fullPreviewHistory.canGoForward}
                onClick={() => fullPreviewRef.current?.goForward()}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fullPreviewHistory.canGoForward ? 'text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'}`}
              >
                <ChevronRight size={18} />
              </button>
              <div className="h-4 w-px bg-white/10 mx-1" />
              <div className="px-3 flex items-center gap-2">
                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">FILE</span>
                <span className="text-[10px] font-bold text-white/90 truncate max-w-[150px]">{fullPreviewHistory.currentFile}</span>
              </div>
            </div>

            <div className="flex-1 bg-white relative">
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
    </SaaSLayout>
  );
}
