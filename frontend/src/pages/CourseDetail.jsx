import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getCourse, getCourseLevels, getUserProgress } from '../services/api';
import { isAdminSessionActive } from '../utils/session';
import {
  Clock,
  Layers,
  Lock,
  CheckCircle,
  Target,
  FileText,
  PlayCircle,
  Award,
  Code,
  Zap,
  Star,
  ChevronRight
} from 'lucide-react';

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [levels, setLevels] = useState([]);
  const [userProgress, setUserProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role === 'faculty') {
      navigate('/faculty/dashboard');
      return;
    }
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      const [courseRes, levelsRes, progressRes] = await Promise.all([
        getCourse(courseId),
        getCourseLevels(courseId),
        getUserProgress(userId)
      ]);
      setCourse(courseRes.data);
      setLevels(levelsRes.data);
      setUserProgress(progressRes.data);
    } catch (error) {
      console.error('Failed to load course:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelStatus = (levelNumber) => {
    if (isAdminSessionActive()) return 'unlocked';
    if (levelNumber === 1) return 'unlocked';
    if (userProgress) {
      const courseProgress = userProgress.courses?.find(c => c.courseId === courseId);
      if (courseProgress) {
        const completedLevels = courseProgress.completedLevels || [];
        if (completedLevels.includes(levelNumber - 1) || (courseProgress.currentLevel || 1) >= levelNumber) {
          return 'unlocked';
        }
      }
    }
    return 'locked';
  };

  const isLevelCompleted = (levelNumber) => {
    if (!userProgress) return false;
    const courseProgress = userProgress.courses?.find(c => c.courseId === courseId);
    return courseProgress?.completedLevels?.includes(levelNumber);
  };

  if (loading) return (
    <SaaSLayout>
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Module Data...</p>
      </div>
    </SaaSLayout>
  );

  if (!course) {
    return (
      <SaaSLayout>
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6 font-black text-4xl">?</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Course Sequence Not Found</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">The requested assessment module could not be retrieved from the ledger. It may have been relocated or renamed.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </SaaSLayout>
    );
  }

  return (
    <SaaSLayout>
      <div className="space-y-10 text-left">
        {/* Course Hero Card */}
        <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/30 via-primary-900/10 to-transparent opacity-60" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />

          <div className="relative z-10 p-10 lg:p-16 flex flex-col lg:flex-row items-center gap-12">
            <div className="w-48 h-48 lg:w-64 lg:h-64 rounded-[3rem] bg-white/10 backdrop-blur-md p-1.5 shadow-2xl flex-shrink-0 group-hover:rotate-2 transition-transform duration-700 border border-white/20">
              <div className="w-full h-full rounded-[2.8rem] overflow-hidden relative bg-slate-800 flex items-center justify-center">
                {course?.thumbnail ? (
                  <img src={course.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={course.title} />
                ) : (
                  <Code size={80} className="text-slate-600" />
                )}
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-primary-500/20 text-primary-300 rounded-full text-[11px] font-black uppercase tracking-widest mb-8 backdrop-blur-md border border-primary-500/30">
                <Zap size={14} fill="currentColor" />
                {course.difficulty} Difficulty
              </div>
              <h1 className="text-5xl lg:text-7xl font-display font-bold text-white tracking-tight mb-6 leading-tight">
                {course.title}
              </h1>
              <p className="text-slate-400 text-lg lg:text-xl max-w-2xl leading-relaxed mb-10 font-medium">
                {course.description}
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400 backdrop-blur-sm">
                    <Clock size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Est. Duration</p>
                    <p className="text-white font-bold text-base">{course.estimatedTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400 backdrop-blur-sm">
                    <Layers size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Syllabus</p>
                    <p className="text-white font-bold text-base">{course.totalLevels} Stages</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Curriculum Section */}
        <div>
          <div className="flex items-center gap-4 mb-10">
            <div className="w-1.5 h-10 bg-primary-600 rounded-full shadow-[0_0_12px_rgba(14,140,233,0.4)]" />
            <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Active Curriculum</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-fade-in-up">
            {levels.map((level) => {
              const status = getLevelStatus(level.level);
              const isLocked = status === 'locked';
              const completed = isLevelCompleted(level.level);
              const isAdmin = isAdminSessionActive();
              const canAccess = isAdmin || (!isLocked);

              return (
                <div
                  key={level.level}
                  onClick={() => canAccess && navigate(`/level/${courseId}/${level.level}`)}
                  className={`card relative group transition-all duration-500
                                ${!canAccess ? 'opacity-70 grayscale-[0.5] cursor-not-allowed shadow-none border-slate-100 hover:shadow-none hover:-translate-y-0' : 'cursor-pointer hover:-translate-y-3'}
                  `}
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-2xl shadow-inner
                                    ${completed ? 'bg-emerald-50 text-emerald-600' : isLocked ? 'bg-slate-50 text-slate-300' : 'bg-primary-50 text-primary-600'}
                                `}>
                      {level.level}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center group-hover:border-primary-200 transition-colors">
                      {isLocked ? (
                        <Lock size={18} className="text-slate-300" />
                      ) : completed ? (
                        <CheckCircle size={18} className="text-emerald-500" />
                      ) : (
                        <PlayCircle size={18} className="text-primary-500 group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-2xl font-display font-bold text-slate-900 mb-3 group-hover:text-primary-600 transition-colors">Level {level.level}</h3>
                  <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">
                    {isLocked ? 'Complete previous Level to unlock this module.' : 'Practical assessment focusing on core industrial concepts.'}
                  </p>

                  <div className="flex items-center gap-3 mb-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">
                    <div className="p-1.5 bg-primary-50 rounded-lg text-primary-500">
                      <FileText size={14} />
                    </div>
                    {level.totalQuestions} Assessments
                  </div>

                  <button
                    disabled={!canAccess}
                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300
                                    ${completed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : isLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'btn-primary'}
                                `}
                  >
                    {isLocked ? 'Locked' : completed ? 'Retake Exam' : 'Enter Stage'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Support Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10 animate-fade-in-up delay-300">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex gap-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 flex-shrink-0">
              <Star size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Academic Honor Code</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Ensure all code submitted is your own. Our automated evaluation engine scans for structural similarities across the platform.
              </p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex gap-6">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
              <Award size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Certification Path</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Upon successful manual evaluation of the final stage, you will be eligible for the **Mastery Certificate** in {course.title}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SaaSLayout>
  );
}
