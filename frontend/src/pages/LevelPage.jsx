import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getCourse, getLevelQuestions } from '../services/api';
import {
  Dices,
  FileText,
  CheckCircle,
  Star,
  Image as ImageIcon,
  Paperclip,
  Lightbulb,
  PlayCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

export default function LevelPage() {
  const { courseId } = useParams(); // LSP: No level param
  const level = 1; // LSP: Always Level 1
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLevelData();
  }, [courseId]);

  const loadLevelData = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      const [courseRes, questionsRes] = await Promise.all([
        getCourse(courseId),
        getLevelQuestions(courseId, level, userId)
      ]);
      setCourse(courseRes.data);

      if (courseRes.data.isCompleted) {
        navigate('/', { replace: true });
        return;
      }

      const loadedQuestions = questionsRes.data || [];

      // LSP Optimization: If only one question, skip overview and go straight to play
      // Check if it's not already completed to allow review, or just enforce strict flow?
      // User said: "remove module type student can attend only one question so directly redirect"
      // This implies bypassing the overview.
      if (loadedQuestions.length === 1) {
        navigate(`/course/${courseId}/level/1`, { replace: true });
        return;
      }

      setQuestions(loadedQuestions);
    } catch (error) {
      console.error('Failed to load level:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <SaaSLayout>
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Module Manifest...</p>
      </div>
    </SaaSLayout>
  );

  const completedCount = questions.filter(q => q.isCompleted).length;
  const isAllCompleted = questions.length > 0 && completedCount === questions.length;

  return (
    <SaaSLayout>
      <div className="space-y-8 text-left">
        {/* Breadcrumb replacement / Module Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-widest">
                Module Overview
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{course?.title}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Practical Assessments</h1>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 border border-slate-100 rounded-2xl shadow-sm">
            <div className="px-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion</p>
              <p className="text-sm font-bold text-slate-900">{completedCount} / {questions.length} Solved</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <CheckCircle size={20} />
            </div>
          </div>
        </div>

        {/* Algorithm Alert */}
        <div className="bg-slate-900 rounded-3xl p-6 text-white flex items-center gap-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-600/10 group-hover:bg-blue-600/20 transition-colors" />
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400 flex-shrink-0 relative z-10">
            <Dices size={24} />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="text-sm font-bold mb-1">Module Assessment</h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
              This module contains {questions.length} challenges. Complete them to master this skill set and unlock the next module in your path.
            </p>
          </div>
        </div>

        {/* Questions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {questions.map((question, index) => (
            <div
              key={question.id}
              onClick={() => navigate(`/challenge/${question.id}`)}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-2xl hover:shadow-slate-200 transition-all cursor-pointer relative"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-slate-100 group-hover:text-slate-200 transition-colors">#{index + 1}</span>
                    {question.isCompleted ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle size={12} /> Validated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        <PlayCircle size={12} /> Pending
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                      <Star size={14} />
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2 truncate group-hover:text-blue-600 transition-colors">{question.title}</h3>
                <p className="text-slate-500 text-sm mb-8 line-clamp-2 leading-relaxed font-medium">
                  {question.description || 'Simulated professional environment requiring specific structural implementations.'}
                </p>

                <div className="flex flex-wrap gap-4 mb-8">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl">
                    <Star size={14} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-600">{question.points} Unit Points</span>
                  </div>
                  {question.assets?.images?.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl">
                      <ImageIcon size={14} className="text-indigo-500" />
                      <span className="text-xs font-bold text-slate-600">{question.assets.images.length} Media Assets</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/course/${courseId}/level/1`);
                  }}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
                    ${question.isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-900 text-white group-hover:bg-blue-600 shadow-xl shadow-slate-900/10'}
                `}>
                  {question.isCompleted ? 'Review Solution' : 'Start Assessment'}
                  {!question.isCompleted && <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
            </div>
          ))}

          {questions.length === 0 && (
            <div className="col-span-full py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
              <AlertCircle size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Assessments Assigned</p>
            </div>
          )}
        </div>

        {/* Level Logic Info */}
        {questions.length > 0 && (
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Module Progress</h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Achieve 100% validation to complete this module.
                </p>
              </div>

              <div className="w-full lg:w-72">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sequence Progress</span>
                  <span className="text-xl font-bold text-slate-900">{Math.round((completedCount / questions.length) * 100)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                    style={{ width: `${(completedCount / questions.length) * 100}%` }}
                  />
                </div>
                {isAllCompleted ? (
                  <p className="mt-4 text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle size={14} /> Full Module Mastered
                  </p>
                ) : (
                  <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Lightbulb size={14} className="text-amber-500" /> Complete all above to proceed
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SaaSLayout>
  );
}
