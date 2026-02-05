import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getCourse, getUserProgress } from '../services/api';
import {
  CheckCircle,
  Lock,
  PlayCircle,
  ArrowRight,
  Layers,
  Star
} from 'lucide-react';

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [courseId]);

  const loadData = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const [courseRes, progressRes] = await Promise.all([
        getCourse(courseId),
        userId ? getUserProgress(userId) : { data: [] }
      ]);

      setCourse(courseRes.data);

      // Determine progress
      const courseProgress = progressRes.data.filter(p => p.course_id === courseId);
      const completed = courseProgress.map(p => p.level);
      setCompletedLevels(completed);

      // Calculate current level (max completed + 1)
      const maxCompleted = Math.max(0, ...completed);
      setCurrentLevel(maxCompleted + 1);

    } catch (error) {
      console.error('Failed to load course details:', error);
    } finally {
      setLoading(false);
    }
  };

  const levels = course ? Array.from({ length: course.totalLevels || 4 }, (_, i) => i + 1) : [];

  if (loading || !course) {
    return (
      <SaaSLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </SaaSLayout>
    );
  }

  return (
    <SaaSLayout>
      <div className="max-w-5xl mx-auto space-y-12 pb-20">

        {/* Header */}
        <div className="text-center space-y-6 pt-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
            <Layers size={14} />
            <span>{course.title} Curriculum</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Select Your Challenge
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Progress through the levels to master this skill path.
          </p>
        </div>

        {/* Timeline of Levels */}
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical Line */}
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-200" />

          <div className="space-y-8">
            {levels.map((level) => {
              const isCompleted = completedLevels.includes(level);
              const isUnlocked = level <= currentLevel;
              const isCurrent = level === currentLevel;

              return (
                <div
                  key={level}
                  onClick={() => {
                    if (!isUnlocked) return;
                    // Direct navigation - unlock check is handled by LevelChallenge
                    navigate(`/course/${courseId}/level/${level}`);
                  }}
                  className={`relative pl-24 transition-all duration-300 group
                    ${isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
                  `}
                >
                  {/* Timeline Node */}
                  <div className={`absolute left-0 w-16 h-16 rounded-2xl flex items-center justify-center border-4 border-white shadow-xl z-10 transition-transform group-hover:scale-105
                    ${isCompleted ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-primary-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' :
                        'bg-slate-100 text-slate-400'
                    }
                  `}>
                    {isCompleted ? <CheckCircle size={28} /> :
                      isCurrent ? <PlayCircle size={28} /> :
                        <Lock size={24} />
                    }
                  </div>

                  {/* Connector Line */}
                  <div className={`absolute left-8 top-16 bottom-[-32px] w-0.5 z-0 ${isCompleted ? 'bg-emerald-500/30' : 'bg-transparent'}`} />

                  {/* Card Content */}
                  <div className={`
                    bg-white rounded-2xl p-6 border transition-all duration-300
                    ${isCurrent ? 'border-primary-200 shadow-xl ring-4 ring-primary-50' : 'border-slate-200 shadow-sm hover:shadow-md'}
                  `}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className={`text-xl font-bold ${isUnlocked ? 'text-slate-900' : 'text-slate-400'}`}>
                            Level {level}
                          </h3>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold uppercase rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm">
                          Core concepts and challenges for Phase {level}.
                        </p>
                      </div>

                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-colors
                        ${isUnlocked ? 'bg-slate-50 text-slate-600 group-hover:bg-primary-600 group-hover:text-white' : 'bg-slate-100 text-slate-300'}
                      `}>
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SaaSLayout>
  );
}
