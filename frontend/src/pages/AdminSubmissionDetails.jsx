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
  const [fullScreenView, setFullScreenView] = useState(null);
  const [previewHistory, setPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
  const [fullPreviewHistory, setFullPreviewHistory] = useState({ canGoBack: false, canGoForward: false, currentFile: 'index.html' });
  const previewRef = useRef(null);
  const fullPreviewRef = useRef(null);

  // Override State
  const [overriding, setOverriding] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideScores, setOverrideScores] = useState({
    codeQuality: 0,
    requirements: 0,
    expectedOutput: 0
  });

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

  const handleApplyOverride = async () => {
    if (!overrideReason.trim()) {
      alert('Please provide a reason for the override.');
      return;
    }
    
    const totalScore = (overrideScores.codeQuality || 0) + 
                       (overrideScores.requirements || 0) + 
                       (overrideScores.expectedOutput || 0);
    const status = totalScore >= 80 ? 'passed' : 'failed';

    if (!window.confirm(`Applying override with total score ${totalScore}% as ${status.toUpperCase()}. Proceed?`)) return;

    try {
      setOverriding(true);
      await api.post(`/admin/submissions/${submissionId}/override`, {
        status,
        reason: overrideReason,
        scores: overrideScores
      });
      // Refresh
      fetchSubmission();
      setOverrideReason('');
      alert(`Submission successfully overridden as ${status.toUpperCase()}`);
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
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4" />
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
  const evaluation = data.evaluation;
  const assignment = data.assignment;

  // Use the existence of the evaluation object itself to determine if it's graded
  const isGraded = !!evaluation;
  const manualScore = isGraded ? evaluation.total_score : null;
  const finalStatus = submission.status;

  return (
    <SaaSLayout fullWidth={true}>
      <div className="flex flex-col h-[calc(100vh-56px)] relative bg-slate-50/50">

        <div className="flex-1 flex overflow-hidden">

          {/* Main Workspace (Flexible Width) */}
          <div className="flex-1 min-w-0 flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Workspace Header */}
            <div className="flex bg-white border-b border-slate-200 items-center justify-between px-4 sticky top-0 z-20 h-14 shrink-0 shadow-sm">
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 transition-colors rounded-md text-slate-500 shrink-0">
                  <ArrowLeft size={16} />
                </button>
                <div className="shrink-0 min-w-0 pr-4 border-r border-slate-100">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[200px]">
                      {submission.candidate_name || 'Anonymous'}
                    </h2>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${finalStatus === 'passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : finalStatus === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      {finalStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">L{submission.level} • {submission.course_title}</span>
                  </div>
                </div>

                <div className="flex items-center overflow-x-auto scrollbar-hide h-full gap-2 px-2 flex-nowrap">
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase transition-all shrink-0 ${activeTab === 'audit'
                      ? 'bg-slate-100 text-slate-900 border border-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    <ShieldAlert size={12} />
                    <span>Audit</span>
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
                      className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase transition-all shrink-0 ${activeTab === tab.id
                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={12} className={tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {[
                    { id: 'student_live', label: 'Live', icon: Play, color: 'text-emerald-500' },
                    { id: 'expected_live', label: 'Ref', icon: BookOpen, color: 'text-blue-500' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase transition-all shrink-0 ${activeTab === tab.id
                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={12} className={tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {[
                    { id: 'terminal', label: 'Term', icon: Terminal, color: 'text-slate-500' },
                    { id: 'instructions', label: 'Question', icon: Info, color: 'text-slate-400' },
                    { id: 'feedback', label: 'Feedback', icon: MatchIcon, color: 'text-indigo-400' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase transition-all shrink-0 ${activeTab === tab.id
                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={12} className={tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 border-l border-slate-100 pl-4 ml-2">
                {manualScore !== null && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Grade</p>
                    <p className="text-sm font-bold text-blue-600 tabular-nums">{manualScore}%</p>
                  </div>
                )}

                <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
                  {activeTab === 'terminal' && (
                    <button
                      onClick={handleRunCode}
                      disabled={evaluatingCode}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {evaluatingCode ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                      {evaluatingCode ? "Running" : "Run Code"}
                    </button>
                  )}
                  {(activeTab === 'student_live' || activeTab === 'expected_live') && (
                    <button
                      onClick={() => setFullScreenView(activeTab === 'student_live' ? 'live' : 'expected')}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                      title="Fullscreen"
                    >
                      <Monitor size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'audit' ? (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                  <div className="max-w-5xl mx-auto space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      {/* Faculty Review */}
                      <div className="bg-white rounded-md p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-emerald-50 rounded">
                              <User size={16} className="text-emerald-600" />
                            </div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Faculty Review</h3>
                          </div>
                        </div>
                        {isGraded ? (
                          <div className="space-y-6">
                            <div>
                              <div className="flex justify-between items-end mb-2">
                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Human Grade</p>
                                <p className="text-2xl font-black text-slate-900">{manualScore}%</p>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full rounded-full transition-all duration-1000 ${manualScore >= 80 ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]'}`} style={{ width: `${manualScore}%` }} />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 py-6 border-y border-slate-100">
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quality</p>
                                <p className="text-lg font-black text-slate-800 tabular-nums">{evaluation.code_quality_score || 0}</p>
                              </div>
                              <div className="text-center border-x border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Reqs</p>
                                <p className="text-lg font-black text-slate-800 tabular-nums">{evaluation.requirements_score || 0}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Output</p>
                                <p className="text-lg font-black text-slate-800 tabular-nums">{evaluation.expected_output_score || 0}</p>
                              </div>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">FACULTY REMARKS</p>
                              <p className="text-slate-600 text-sm italic leading-relaxed font-medium">
                                "{evaluation.comments || 'No comments provided.'}"
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-14 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <Clock size={32} className="text-slate-300 mb-4 animate-slow-spin" />
                            <div className="text-center">
                              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Review In Progress</p>
                              {assignment ? (
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-slate-500">Assigned to {assignment.faculty_name}</p>
                                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                                      Status: <span className="text-blue-500 font-black">{assignment.status.toUpperCase()}</span>
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs font-medium text-slate-400 italic">Not yet assigned to a faculty member.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'html' || activeTab === 'css' || activeTab === 'js' ? (
                <div className="flex-1 overflow-hidden flex flex-col bg-white">
                  <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center border border-slate-200 ${activeTab === 'html' ? 'bg-orange-50 text-orange-500' : activeTab === 'css' ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
                        <Code size={12} />
                      </div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{activeTab.toUpperCase()} Source</h4>
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
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-10">
                  <div className="max-w-4xl mx-auto space-y-10 text-left">
                    {/* Question Header: Professional Minimal */}
                    <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm">
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
                    <div className="space-y-10 bg-white rounded-2xl p-10 border border-slate-200 shadow-sm">
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
              ) : activeTab === 'feedback' ? (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                  <div className="max-w-3xl mx-auto space-y-6 text-left">
                    <div className="bg-white rounded-md p-6 border border-slate-200 shadow-sm">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
                        <User size={12} className="text-indigo-500" />
                        Student Feedback
                      </h3>
                      {data.studentFeedback ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Rating</p>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <div key={star} className={`w-4 h-4 rounded-full ${star <= data.studentFeedback.rating ? 'bg-amber-400' : 'bg-slate-200'}`} />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="p-4 bg-indigo-50/30 rounded border border-indigo-100 text-left">
                            <p className="text-slate-700 text-sm leading-relaxed italic">
                              "{data.studentFeedback.comments || 'No specific comments provided.'}"
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-400 italic text-xs">
                          No student feedback has been submitted yet for this level.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Panel: Admin Overrides (Fixed Width) */}
          <div className="w-[280px] bg-white border-l border-slate-200 overflow-y-auto p-5 shrink-0 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
              <ShieldAlert size={14} className="text-amber-500" />
              Override actions
            </h3>

            <div className="space-y-6">
              {submission.admin_override_status && submission.admin_override_status !== 'none' && (
                <div className="bg-blue-50 rounded-md p-4 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Active Override</p>
                  <p className="text-sm font-bold text-blue-900 capitalize mb-1">{submission.admin_override_status}</p>
                  <p className="text-xs text-blue-700 italic">"{submission.admin_override_reason}"</p>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score Breakdown</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-20 text-left">Quality</span>
                    <input
                      type="number"
                      value={overrideScores.codeQuality}
                      onChange={e => setOverrideScores({ ...overrideScores, codeQuality: Math.min(40, Math.max(0, parseInt(e.target.value) || 0)) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none text-right font-bold text-blue-600"
                      min="0" max="40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-20 text-left">Reqs</span>
                    <input
                      type="number"
                      value={overrideScores.requirements}
                      onChange={e => setOverrideScores({ ...overrideScores, requirements: Math.min(25, Math.max(0, parseInt(e.target.value) || 0)) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none text-right font-bold text-blue-600"
                      min="0" max="25"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-20 text-left">Output</span>
                    <input
                      type="number"
                      value={overrideScores.expectedOutput}
                      onChange={e => setOverrideScores({ ...overrideScores, expectedOutput: Math.min(35, Math.max(0, parseInt(e.target.value) || 0)) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none text-right font-bold text-blue-600"
                      min="0" max="35"
                    />
                  </div>
                  <div className="flex justify-between items-center px-1 border-t border-slate-100 pt-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-900 uppercase">Total</span>
                    <span className="text-sm font-black text-blue-600">{overrideScores.codeQuality + overrideScores.requirements + overrideScores.expectedOutput}%</span>
                  </div>
                </div>

                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mt-4">Justification</label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Reason for override..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-3 text-xs h-20 focus:bg-white focus:border-blue-400 outline-none transition-all resize-none text-slate-700"
                />
                <div className="space-y-3">
                  <button
                    onClick={handleApplyOverride}
                    disabled={overriding}
                    className="w-full py-3 bg-slate-900 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ShieldAlert size={14} /> Apply Score Override
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Payload Size</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">HTML</span>
                    <span className="text-[11px] font-mono text-slate-700">{(submission.html_code || '').length} B</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">CSS</span>
                    <span className="text-[11px] font-mono text-slate-700">{(submission.css_code || '').length} B</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">JS</span>
                    <span className="text-[11px] font-mono text-slate-700">{(submission.js_code || '').length} B</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fullscreen Preview Modal */}
        {fullScreenView && (
          <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
            <div className="h-12 bg-slate-900 border-b border-white/10 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${fullScreenView === 'live' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                  {fullScreenView === 'live' ? 'Candidate Review' : 'Reference Question'}
                </span>
              </div>
              <button
                onClick={() => setFullScreenView(null)}
                className="w-8 h-8 rounded hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all"
              >
                <XCircle size={16} />
              </button>
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
