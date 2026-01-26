import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import ReadOnlyCodeBlock from '../components/ReadOnlyCodeBlock';
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
  ChevronRight,
  Trophy,
  ShieldAlert,
  Save
} from 'lucide-react';

const SectionCard = ({ title, icon: Icon, children }) => (
  <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
    <header className="px-8 py-5 border-b border-slate-50 flex items-center gap-3">
      {Icon && <Icon size={18} className="text-blue-500" />}
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{title}</h2>
    </header>
    <div className="p-8">
      {children}
    </div>
  </section>
);

const ScoreBadge = ({ label, value }) => (
  <div className="flex flex-col rounded-2xl border border-slate-100 p-5 bg-slate-50/50">
    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">{label}</span>
    <span className={`text-2xl font-bold ${value >= 70 ? 'text-emerald-600' : 'text-rose-500'}`}>
      {value ?? 0}%
    </span>
  </div>
);

export default function AdminSubmissionDetails() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/submissions/${submissionId}`);
        setSubmission(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load submission details.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmission();
  }, [submissionId]);

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
      const response = await api.get(`/submissions/${submissionId}`);
      setSubmission(response.data);
      setOverrideReason('');
      alert(`Submission successfully marked as ${status.toUpperCase()}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply override');
    } finally {
      setOverriding(false);
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

  const evaluation = submission?.result || {};
  const finalScore = evaluation.finalScore ?? submission?.total_score ?? 0;
  const structureScore = evaluation.structureScore ?? submission?.structure_score ?? 0;
  const visualScore = evaluation.visualScore ?? submission?.visual_score ?? 0;
  const contentScore = evaluation.contentScore ?? submission?.content_score ?? 0;

  return (
    <SaaSLayout>
      <div className="space-y-8 text-left">
        {/* Top Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inspect Submission</h1>
              <p className="text-slate-500 text-sm mt-1">Transaction Instance: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded uppercase">{submissionId}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2
              ${submission.status === 'passed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                submission.status === 'failed' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                  'bg-blue-50 text-blue-600 border border-blue-100'}
            `}>
              {submission.status === 'passed' ? <CheckCircle size={14} /> : submission.status === 'failed' ? <XCircle size={14} /> : <Clock size={14} />}
              {submission.status || 'Pending'}
            </div>
          </div>
        </div>

        {/* Evaluation Comparison Row - NOW AT TOP */}
        {evaluation.feedback && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Trophy size={160} className="text-slate-900" />
            </div>

            {/* Automated Feedback Card */}
            <div className="p-8 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Cpu size={20} className="text-blue-400" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Automated Diagnostic</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">AI Trust Score</p>
                  <p className="text-3xl font-black text-white">{Math.round(finalScore)}%</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000" style={{ width: `${finalScore}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Content</p>
                      <p className="font-bold text-sm text-blue-100">{Math.round(contentScore)}%</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Visual</p>
                      <p className="font-bold text-sm text-blue-100">{Math.round(visualScore)}%</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">DOM</p>
                      <p className="font-bold text-sm text-blue-100">{Math.round(structureScore)}%</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 relative">
                  <span className="absolute -top-3 left-4 px-2 bg-slate-900 text-[10px] font-black text-slate-500 uppercase tracking-widest">Feedback Narrative</span>
                  <p className="text-slate-300 text-sm italic leading-relaxed">
                    "{typeof evaluation.feedback === 'string'
                      ? evaluation.feedback
                      : (evaluation.feedback.encouragement?.[0] || 'Technical evaluation complete.')}"
                  </p>
                </div>
              </div>
            </div>

            {/* Faculty Feedback Card */}
            <div className="p-8 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <User size={20} className="text-white" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Faculty Evaluation</h3>
                </div>
                {submission.manual_score !== null && (
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest mb-1">Final Grade</p>
                    <p className="text-3xl font-black text-white">{submission.manual_score}%</p>
                  </div>
                )}
              </div>

              {submission.manual_score !== null ? (
                <div className="space-y-6">
                  <div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-6">
                      <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${submission.manual_score}%` }} />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                        <p className="text-[9px] font-black text-blue-200 uppercase mb-1">Logic</p>
                        <p className="font-bold text-sm text-white">{submission.code_quality_score}/40</p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                        <p className="text-[9px] font-black text-blue-200 uppercase mb-1">Reqs</p>
                        <p className="font-bold text-sm text-white">{submission.requirements_score}/25</p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                        <p className="text-[9px] font-black text-blue-200 uppercase mb-1">Output</p>
                        <p className="font-bold text-sm text-white">{submission.expected_output_score}/35</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-white/10 rounded-2xl border border-white/10 relative">
                    <span className="absolute -top-3 left-4 px-2 bg-blue-600 text-[10px] font-black text-blue-200 uppercase tracking-widest">Faculty Comments</span>
                    <p className="text-blue-50 text-sm italic leading-relaxed">
                      "{submission.manual_feedback || 'No comments provided.'}"
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold">
                        {submission.evaluator_name?.charAt(0) || 'F'}
                      </div>
                      <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Evaluated by {submission.evaluator_name}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-white/5">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <Clock size={32} className="text-blue-100 animate-pulse" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">Review In Progress</p>
                  <p className="text-xs text-blue-200 mt-2">Waiting for faculty judgment</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Meta Data */}
          <div className="lg:col-span-1 space-y-8">
            <SectionCard title="Identity" icon={User}>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-xl ring-4 ring-slate-50">
                    {submission.candidateName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-lg leading-tight">{submission.candidateName || 'Anonymous User'}</p>
                    <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">Student UID: {submission.userId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-bold bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Terminal size={16} className="text-blue-500" />
                    <span>{submission.challengeId}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-bold bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Calendar size={16} className="text-emerald-500" />
                    <span>{new Date(submission.submittedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Source Code Stats" icon={Cpu}>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total Size</span>
                  <span className="font-bold text-slate-900">
                    {((submission?.code?.html || '').length + (submission?.code?.css || '').length + (submission?.code?.js || '').length).toLocaleString()} Bytes
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400">Lines of Code</span>
                  <span className="font-bold text-slate-900">
                    {((submission?.code?.html || '').split('\n').length + (submission?.code?.css || '').split('\n').length + (submission?.code?.js || '').split('\n').length)} Lines
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Content Data */}
          <div className="lg:col-span-2 space-y-8">
            <SectionCard title="Source Code Audit" icon={Code}>
              <div className="space-y-8">
                {['html', 'css', 'js'].map(lang => (
                  <div key={lang}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${lang === 'html' ? 'bg-orange-500' : lang === 'css' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{lang} source</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{(submission?.code?.[lang] || '').length} Bytes</span>
                    </div>
                    <ReadOnlyCodeBlock
                      code={submission?.code?.[lang]}
                      language={lang}
                      height="450px"
                    />
                  </div>
                ))}
              </div>
            </SectionCard>

            {(submission.user_screenshot || submission.expected_screenshot || submission.diff_screenshot) && (
              <SectionCard title="Visual Delta Analysis" icon={Monitor}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 p-2">
                  {submission.user_screenshot && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Candidate Rendering</p>
                      <div className="rounded-[2.5rem] border-8 border-slate-100 overflow-hidden shadow-2xl group relative">
                        <img src={submission.user_screenshot} className="w-full h-auto group-hover:scale-110 transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                  {submission.expected_screenshot && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Production Template</p>
                      <div className="rounded-[2.5rem] border-8 border-slate-100 overflow-hidden shadow-2xl group relative">
                        <img src={submission.expected_screenshot} className="w-full h-auto group-hover:scale-110 transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                  {submission.diff_screenshot && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pixel-Match Diff</p>
                      <div className="rounded-[2.5rem] border-8 border-slate-100 overflow-hidden shadow-2xl group relative bg-slate-900">
                        <img src={submission.diff_screenshot} className="w-full h-auto group-hover:scale-110 transition-transform duration-[2s]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Admin Override Section */}
            <SectionCard title="Administrative Override" icon={ShieldAlert}>
              <div className="space-y-6">
                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 flex items-start gap-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <ShieldAlert size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Force Evaluation Result</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      Admins can manually override the final status. This will bypass both AI and Faculty scoring.
                      A mandatory reason must be provided for audit purposes.
                    </p>
                  </div>
                </div>

                {submission.admin_override_status !== 'none' && (
                  <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Active Override</p>
                    <p className="text-sm font-bold text-blue-900 capitalize">Status: {submission.admin_override_status}</p>
                    <p className="text-xs text-blue-700 mt-2 italic font-medium">"{submission.admin_override_reason}"</p>
                  </div>
                )}

                <div className="space-y-4">
                  <textarea
                    placeholder="Enter justification for manual override..."
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleOverride('passed')}
                      disabled={overriding}
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      <CheckCircle size={18} className="group-hover:scale-110 transition-transform" />
                      Force Pass
                    </button>
                    <button
                      onClick={() => handleOverride('failed')}
                      disabled={overriding}
                      className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      <XCircle size={18} className="group-hover:scale-110 transition-transform" />
                      Force Fail
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </SaaSLayout>
  );
}
