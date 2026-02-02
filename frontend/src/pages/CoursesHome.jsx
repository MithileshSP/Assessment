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
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Available Courses</h1>
            <p className="text-slate-500 mt-2 text-lg">Select a learning path to begin your assessment.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-premium">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-[0_0_12px_rgba(14,140,233,0.5)] animate-pulse" />
            <span className="text-sm font-semibold text-slate-700">{courses.length} Courses Active</span>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-fade-in-up">
          {courses
            .filter(c => {
              // Hide hidden courses from non-admins
              if (c.isHidden && !isAdmin) return false;
              // Hide courses with unmet prerequisites from non-admins
              if (c.prerequisiteCourseId && !c.isPrerequisiteMet && !isAdmin) return false;
              return true;
            })
            .map((course) => (
              <div
                key={course.id}
                onClick={() => navigate(`/course/${course.id}`)}
                className="card !p-0 overflow-hidden cursor-pointer group relative"
              >
                {course.isHidden && (
                  <div className="absolute top-5 right-5 z-10 bg-amber-400 text-amber-950 text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xl backdrop-blur-md">
                    <EyeOff size={12} /> PRIVATE
                  </div>
                )}

                {/* Prerequisite Locked Badge (Admin only) */}
                {course.prerequisiteCourseId && !course.isPrerequisiteMet && isAdmin && (
                  <div className="absolute top-5 left-5 z-10 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xl backdrop-blur-md">
                    <Lock size={12} /> Requires: {course.prerequisiteCourseName}
                  </div>
                )}

                {/* Course Thumbnail */}
                <div className="h-52 flex items-center justify-center relative overflow-hidden bg-slate-100">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                      <Code size={48} className="text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Course Info */}
                <div className="p-7">
                  <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-primary-600 transition-colors leading-tight mb-3">
                    {course.title}
                  </h3>

                  <p className="text-slate-500 text-sm mb-6 line-clamp-2 leading-relaxed font-medium">
                    {course.description}
                  </p>

                  {/* Course Meta */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-slate-400">
                      <div className="p-1.5 bg-primary-50 rounded-lg text-primary-600">
                        <Layers size={14} />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider">{course.totalLevels} Levels</span>
                    </div>
                    <span className={`badge ${course.difficulty === 'Beginner' ? 'badge-easy' : course.difficulty === 'Intermediate' ? 'badge-medium' : 'badge-hard'}`}>
                      {course.difficulty}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                    <div className="flex -space-x-2.5">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
                          {i}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-primary-600 font-bold text-sm tracking-tight">
                      <span>Enter Course</span>
                      <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all">
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {courses.length === 0 && !loading && (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                <Layout size={32} />
              </div>
              <p className="font-medium">No courses available at the moment.</p>
            </div>
          )}
        </div>
      </div>
    </SaaSLayout>
  );
}
