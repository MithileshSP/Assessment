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

  return (
    <SaaSLayout>
      <div className="space-y-10 text-left">
        {/* Course Hero Card */}
        <div className="bg-[#1e293b] rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200 group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-50" />
          <div className="relative z-10 p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-10">
            <div
              className="w-40 h-40 lg:w-56 lg:h-56 rounded-[2.5rem] bg-white p-1 shadow-2xl flex-shrink-0 group-hover:rotate-3 transition-transform duration-500"
            >
              <div className="w-full h-full rounded-[2.2rem] overflow-hidden relative bg-slate-100 flex items-center justify-center">
                {course.thumbnail ? (
                  <img src={course.thumbnail} className="w-full h-full object-cover" />
                ) : (
                  <Code size={64} className="text-slate-300" />
                )}
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-6">
                <Zap size={12} fill="currentColor" />
                {course.difficulty} Difficulty
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-white tracking-tight mb-4">{course.title}</h1>
              <p className="text-slate-400 text-lg lg:text-xl max-w-2xl leading-relaxed mb-8">{course.description}</p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
                    <Clock size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Est. Duration</p>
                    <p className="text-white font-bold">{course.estimatedTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
                    <Layers size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Syllabus</p>
                    <p className="text-white font-bold">{course.totalLevels} Stages</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Curriculum Section */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-8 bg-blue-600 rounded-full" />
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Active Curriculum</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                  className={`bg-white rounded-3xl border border-slate-200 p-8 shadow-sm transition-all duration-300 relative group
                                ${!canAccess ? 'opacity-60 grayscale cursor-not-allowed' : 'cursor-pointer hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-2'}
                            `}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl
                                    ${completed ? 'bg-emerald-50 text-emerald-600' : isLocked ? 'bg-slate-50 text-slate-300' : 'bg-blue-50 text-blue-600'}
                                `}>
                      {level.level}
                    </div>
                    {isLocked ? <Lock size={20} className="text-slate-300" /> : completed ? <CheckCircle size={20} className="text-emerald-500" /> : <ChevronRight size={20} className="text-blue-500 group-hover:translate-x-1 transition-transform" />}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">Stage {level.level}</h3>
                  <p className="text-slate-500 text-sm mb-6 font-medium">
                    {isLocked ? 'Complete previous stage to unlock this module.' : 'Practical assessment focusing on core concepts.'}
                  </p>

                  <div className="flex items-center gap-2 mb-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <FileText size={14} className="text-blue-500" />
                    {level.totalQuestions} Assessments
                  </div>

                  <button
                    disabled={!canAccess}
                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all
                                    ${completed ? 'bg-emerald-50 text-emerald-600' : isLocked ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-xl shadow-slate-900/10 hover:shadow-blue-600/20'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
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
