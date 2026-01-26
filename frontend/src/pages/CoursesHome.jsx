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
  Layout
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
      const response = await getCourses();
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
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Available Courses</h1>
            <p className="text-slate-500 mt-1">Select a learning path to begin your assessment.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <span className="text-sm font-bold text-slate-700">{courses.length} Courses Active</span>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-8 animate-fade-in-up delay-100">
          {courses.filter(c => !c.isHidden || isAdmin).map((course) => (
            <div
              key={course.id}
              onClick={() => navigate(`/course/${course.id}`)}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer group hover:shadow-xl hover:shadow-slate-200 hover:-translate-y-1 transition-all duration-300 relative"
            >
              {course.isHidden && (
                <div className="absolute top-4 right-4 z-10 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                  <EyeOff size={12} /> PRIVATE
                </div>
              )}

              {/* Course Thumbnail */}
              <div
                className="h-44 flex items-center justify-center relative overflow-hidden bg-slate-100"
              >
                {course.thumbnail ? (
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Code size={48} className="text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              {/* Course Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">
                    {course.title}
                  </h3>
                </div>

                <p className="text-slate-500 text-sm mb-6 line-clamp-2 leading-relaxed">
                  {course.description}
                </p>

                {/* Course Meta */}
                <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase mb-6">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Layers size={14} className="text-blue-500" />
                    <span>{course.totalLevels} Levels</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg ${getDifficultyColor(course.difficulty)}`}>
                    {course.difficulty}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500`}>
                        {i}
                      </div>
                    ))}
                  </div>
                  <span className="text-blue-600 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Enter <ArrowRight size={14} />
                  </span>
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
