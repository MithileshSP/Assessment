import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getCourses } from '../services/api';
import {
  BookOpen,
  Clock,
  Layers,
  ArrowRight,
  EyeOff,
  Code,
  Layout,
  Lock
} from 'lucide-react';
import {
  isAdminSessionActive,
} from '../utils/session';

export default function CoursesHome() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => isAdminSessionActive());
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role === 'faculty') {
      navigate('/faculty/dashboard');
      return;
    }
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      // Pass userId for prerequisite checking
      const userId = localStorage.getItem('userId');
      const response = await getCourses(userId ? { userId } : {});
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      'Beginner': 'bg-emerald-100 text-emerald-800',
      'Intermediate': 'bg-amber-100 text-amber-800',
      'Advanced': 'bg-rose-100 text-rose-800'
    };
    return colors[difficulty] || 'bg-slate-100 text-slate-800';
  };

  return (
    <SaaSLayout>
      <div className="max-w-4xl mx-auto space-y-12 pb-20">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
            <Layers size={14} />
            <span>Structured Curriculum</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 tracking-tight">
            Your Skill Path
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Progress through each level to master your skills. Complete each level to unlock the next.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative pl-8 md:pl-0">
          {/* Vertical Line (Desktop: Center, Mobile: Left) */}
          <div className="absolute left-8 md:left-1/2 top-4 bottom-10 w-0.5 bg-slate-200 -translate-x-1/2 hidden md:block" />
          <div className="absolute left-0 top-4 bottom-10 w-0.5 bg-slate-200 block md:hidden" />

          <div className="space-y-12">
            {courses
              .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) // Enforce Linear Order
              .filter(c => {
                // Hide hidden courses from non-admins
                if (c.isHidden && !isAdmin) return false;
                // Show all other courses (even if locked, so they appear on timeline)
                return true;
              })
              .map((course, index) => {
                // Status Logic
                const isLocked = course.prerequisiteCourseId && !course.isPrerequisiteMet && !isAdmin;
                // If not locked and not completed, it's active. (We assume "completed" flag exists or we infer it)
                // For now, if Prereq Met, we treat as Active/Available. 
                // Ideally backend sends `isCompleted` if we check `user_progress` or `test_sessions`.
                // Let's assume strict Lock Check is the main gate.

                const isEven = index % 2 === 0;

                return (
                  <div key={course.id} className={`relative flex items-center md:justify-between ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} group animate-fade-in-up`} style={{ animationDelay: `${index * 100}ms` }}>

                    {/* Timeline Node */}
                    <div className={`absolute left-0 md:left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-4 border-white shadow-md z-10 flex items-center justify-center transition-transform hover:scale-110
                      ${isLocked
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-primary-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]'
                      }
                    `}>
                      {isLocked ? <Lock size={16} /> : <span className="font-bold text-sm">{index + 1}</span>}
                    </div>

                    {/* Spacer for Desktop Alignment */}
                    <div className="hidden md:block w-5/12" />

                    {/* Card */}
                    <div
                      onClick={() => !isLocked && navigate(`/level/${course.id}`)}
                      className={`
                        w-full md:w-5/12 ml-12 md:ml-0 cursor-pointer transition-all duration-300 relative
                        ${isLocked
                          ? 'opacity-60 grayscale cursor-not-allowed'
                          : 'hover:-translate-y-2 hover:shadow-2xl'
                        }
                      `}
                    >
                      <div className="bg-white rounded-[2rem] p-2 border border-slate-100 shadow-xl overflow-hidden relative">
                        {/* Card Content */}
                        <div className="relative z-10 bg-white rounded-[1.5rem] p-6 border border-slate-50">
                          {/* Top: Status Badges */}
                          <div className="flex justify-between items-start mb-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${course.difficulty === 'Beginner' ? 'bg-emerald-50 text-emerald-600' :
                              course.difficulty === 'Intermediate' ? 'bg-amber-50 text-amber-600' :
                                'bg-rose-50 text-rose-600'
                              }`}>
                              {course.difficulty}
                            </span>
                            {isLocked && (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-500">
                                <Lock size={10} /> Locked
                              </span>
                            )}
                          </div>

                          <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">
                            Level {index}: {course.title}
                          </h3>
                          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-6">
                            {course.description}
                          </p>

                          {/* Action Footer */}
                          <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                              <Clock size={14} />
                              <span>{course.estimatedTime}</span>
                            </div>

                            <button
                              disabled={isLocked}
                              className={`
                                flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                                ${isLocked
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white'
                                }
                              `}
                            >
                              {isLocked ? 'Locked' : 'Start Level'}
                              {!isLocked && <ArrowRight size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Background Decoration */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-br ${isLocked ? 'from-slate-100 to-slate-200' : 'from-blue-500/5 to-purple-500/5'}`} />
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
