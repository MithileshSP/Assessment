import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PreviewFrame from '../components/PreviewFrame';

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

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!data) return <div className="p-8 text-center text-red-600">Submission not found</div>;

    const { submission } = data;
    const totalScore = parseInt(scores.codeQuality) + parseInt(scores.requirements) + parseInt(scores.expectedOutput);

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow px-4 py-3 flex justify-between items-center z-10">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate('/faculty/dashboard')} className="text-gray-600 hover:text-black">&larr; Back</button>
                    <h1 className="text-lg font-bold">Evaluating: {submission.candidate_name}</h1>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{submission.course_title} - Level {submission.level}</span>
                </div>
                <div>
                    {/* Timer or other info could go here */}
                </div>
            </header>

            <div className={`flex-1 flex overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
                {/* Left Panel: Info (15%) */}
                <div className={`${isFullScreen ? 'hidden' : 'w-[15%]'} bg-white border-r border-gray-200 overflow-y-auto p-4`}>
                    <h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-4">Submission Details</h3>

                    <div className="mb-6">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <div className="flex flex-col gap-2">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit ${submission.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {submission.status}
                            </span>
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
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline text-left"
                                >
                                    Retry Evaluation
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Submitted</p>
                        <p className="text-xs font-semibold text-slate-700 leading-tight">
                            {new Date(submission.submitted_at).toLocaleDateString()}<br />
                            {new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    {data.studentFeedback && (
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-4">Student Feedback</h3>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Difficulty</p>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <div key={star} className={`w-2 h-2 rounded-full ${star <= data.studentFeedback.difficulty_rating ? 'bg-amber-400' : 'bg-slate-200'}`} />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Clarity</p>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <div key={star} className={`w-2 h-2 rounded-full ${star <= data.studentFeedback.clarity_rating ? 'bg-blue-400' : 'bg-slate-200'}`} />
                                        ))}
                                    </div>
                                </div>

                                {data.studentFeedback.comments && (
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Comments</p>
                                        <p className="text-[11px] text-slate-600 leading-relaxed italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            "{data.studentFeedback.comments}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Middle Panel: Workspace (55%) */}
                <div className={`${isFullScreen ? 'w-full' : 'w-[55%]'} bg-slate-900 text-white flex flex-col relative`}>
                    <div className="flex bg-slate-800 border-b border-slate-700 items-center justify-between pr-4">
                        <div className="flex overflow-x-auto no-scrollbar">
                            {[
                                { id: 'html', label: 'HTML' },
                                { id: 'css', label: 'CSS' },
                                { id: 'js', label: 'JS' },
                                { id: 'instructions', label: 'Instructions' },
                                { id: 'student_live', label: 'Student Live' },
                                { id: 'expected_live', label: 'Expected Live' },
                                { id: 'compare', label: 'Screenshots' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-3 text-[10px] font-bold tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-700 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isFullScreen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                )}
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto bg-[#0f172a] custom-scrollbar">
                        {activeTab === 'compare' ? (
                            <div className="h-full flex flex-col md:flex-row gap-px bg-slate-800">
                                <div className="flex-1 bg-slate-900 p-4 flex flex-col">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Candidate Output</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-bold">SCREENSHOT</span>
                                    </div>
                                    <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl bg-white group">
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
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs italic">No screenshot captured</div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 bg-slate-900 p-4 flex flex-col border-l border-slate-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Expected Result</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">REFERENCE</span>
                                    </div>
                                    <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl bg-white">
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
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs italic">No reference image</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'instructions' ? (
                            <div className="h-full overflow-auto bg-gray-50/50">
                                <div className="max-w-4xl mx-auto p-8 md:p-12">
                                    {/* Question Header */}
                                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-8">
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                                                    ID: #{submission.challenge_id || 'N/A'}
                                                </span>
                                                <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-100">
                                                    {submission.course_title} • Level {submission.level}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Assessment</span>
                                            </div>
                                        </div>

                                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-4">
                                            {submission.challenge_title || "Final Assessment"}
                                        </h3>
                                        <div className="h-1.5 w-24 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"></div>
                                    </div>

                                    {/* Question Content */}
                                    <div className="space-y-8">
                                        {submission.challenge_description && (
                                            <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                                                <h4 className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
                                                    <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center italic font-serif text-lg">i</span>
                                                    Description
                                                </h4>
                                                <div className="text-slate-700 leading-[1.8] text-base md:text-lg whitespace-pre-wrap font-medium">
                                                    {submission.challenge_description}
                                                </div>
                                            </section>
                                        )}

                                        <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                                            <h4 className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
                                                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">✓</span>
                                                Instructions & Samples
                                            </h4>
                                            <div className="prose prose-slate max-w-none">
                                                <div
                                                    className="text-slate-700 leading-[1.8] text-base md:text-lg font-medium"
                                                    dangerouslySetInnerHTML={{ __html: submission.challenge_instructions || "No instructions provided." }}
                                                />
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'student_live' ? (
                            <div className="h-full bg-white relative flex flex-col">
                                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-slate-900/80 backdrop-blur-sm text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                                    Student Live Rendering
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
                            <div className="h-full bg-white relative flex flex-col">
                                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-emerald-900/80 backdrop-blur-sm text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                                    Expected Result Rendering
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
                            <div className="p-6 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                                        {activeTab === 'html' ? 'HTML' : activeTab === 'css' ? 'CSS' : 'Javascript'} Code
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-wider">Candidate Source</span>
                                </div>
                                <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800/50 overflow-auto p-4 custom-scrollbar">
                                    <pre className="font-mono text-xs leading-relaxed whitespace-pre text-slate-300">
                                        {activeTab === 'html' ? submission.html_code : activeTab === 'css' ? submission.css_code : submission.js_code}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Scoring (30%) */}
                <div className={`${isFullScreen ? 'hidden' : 'w-[30%]'} bg-white border-l border-gray-200 overflow-y-auto p-6`}>
                    <div className="mb-8">
                        <h3 className="font-black text-2xl text-slate-900 tracking-tight">Rubix</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Assessment Intelligence Engine</p>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-lg group">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Code Quality</label>
                                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">Structure, naming, formatting</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" min="0" max="40"
                                        value={scores.codeQuality}
                                        onChange={e => setScores({ ...scores, codeQuality: Math.min(40, Math.max(0, e.target.value)) })}
                                        className="w-16 h-10 text-center font-bold text-blue-600 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                    <span className="text-[10px] font-bold text-slate-300">/ 40</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-lg group">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Requirements</label>
                                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">Core features & logic</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" min="0" max="25"
                                        value={scores.requirements}
                                        onChange={e => setScores({ ...scores, requirements: Math.min(25, Math.max(0, e.target.value)) })}
                                        className="w-16 h-10 text-center font-bold text-blue-600 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                    <span className="text-[10px] font-bold text-slate-300">/ 25</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-lg group">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Visual/UI</label>
                                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">Pixel perfect matching</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" min="0" max="35"
                                        value={scores.expectedOutput}
                                        onChange={e => setScores({ ...scores, expectedOutput: Math.min(35, Math.max(0, e.target.value)) })}
                                        className="w-16 h-10 text-center font-bold text-blue-600 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                    <span className="text-[10px] font-bold text-slate-300">/ 35</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aggregated Intelligence</span>
                                    <h4 className="text-3xl font-black text-slate-900 mt-1">{totalScore}<span className="text-slate-300">/100</span></h4>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${totalScore >= 80 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                                    {totalScore >= 80 ? 'PASS' : 'FAIL'}
                                </div>
                            </div>

                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Evaluator Notes</label>
                            <textarea
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none mb-6"
                                placeholder="Add specific feedback for the student..."
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="group relative w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest overflow-hidden transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {submitting ? 'Processing Submission...' : 'Finalize & Submit'}
                                    {!submitting && <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
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
