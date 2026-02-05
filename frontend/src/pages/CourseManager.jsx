import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getCourses, updateCourse, createCourse, deleteCourse } from '../services/api';
import CourseEditModal from '../components/CourseEditModal';
import {
  Plus,
  Settings,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Database,
  BookOpen,
  Clock,
  Layers,
  HelpCircle,
  ExternalLink,
  Briefcase,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export default function CourseManager() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Removed [managingQuestions, setManagingQuestions] state
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await getCourses();
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCourse = async (courseData) => {
    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, courseData);
        alert('Level updated successfully!');
      } else {
        await createCourse(courseData);
        alert('Level created successfully!');
      }
      setEditingCourse(null);
      setShowCreateModal(false);
      await loadCourses();
    } catch (error) {
      alert('Failed to save course: ' + error.message);
    }
  };

  const handleToggleHidden = async (course) => {
    try {
      const newHiddenStatus = !course.isHidden;
      await updateCourse(course.id, { isHidden: newHiddenStatus });
      await loadCourses();
    } catch (error) {
      alert('Failed to update visibility: ' + error.message);
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${courseTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteCourse(courseId);
      await loadCourses();
    } catch (error) {
      alert('Failed to delete course: ' + error.message);
    }
  };

  const handleMove = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= courses.length) return;

    // 1. Create a reordered copy
    const reordered = [...courses];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // 2. Persist new sequential orders to avoid duplicates/loops
    try {
      // Optimistic UI update
      const optimisticCourses = reordered.map((c, i) => ({ ...c, orderIndex: (i + 1) * 10 }));
      setCourses(optimisticCourses);

      await Promise.all(optimisticCourses.map(c =>
        updateCourse(c.id, { orderIndex: c.orderIndex })
      ));

      await loadCourses();
    } catch (error) {
      alert('Failed to reorder: ' + error.message);
      await loadCourses();
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-8 text-left">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Level Management</h1>
            <p className="text-slate-500 mt-1">Design skill path levels and manage question banks.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10"
            >
              <Plus size={16} /> Create New Level
            </button>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 gap-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 italic text-slate-400">
              <Database size={48} className="animate-bounce mb-4 opacity-10" />
              Querying level registry...
            </div>
          ) : (
            courses.map((course, index) => (
              <div key={course.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col lg:flex-row">
                  {/* Visual Side */}
                  <div
                    className="lg:w-72 h-48 lg:h-auto flex items-center justify-center relative overflow-hidden text-white"
                    style={{ backgroundColor: course.color || '#1e293b' }}
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-500">{course.icon || '📚'}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">ID: {course.id}</span>
                    </div>
                    {course.isHidden && (
                      <div className="absolute top-4 left-4 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                        <EyeOff size={12} /> PRIVATE
                      </div>
                    )}
                  </div>

                  {/* Content Side */}
                  <div className="flex-1 p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${course.difficulty === 'Advanced' ? 'bg-rose-50 text-rose-600' :
                              course.difficulty === 'Intermediate' ? 'bg-amber-50 text-amber-600' :
                                'bg-emerald-50 text-emerald-600'
                              }`}>
                              {course.difficulty}
                            </span>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{course.title}</h2>
                          <p className="text-slate-500 text-sm mt-2 max-w-2xl leading-relaxed">{course.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleHidden(course)}
                            className={`p-2 rounded-xl transition-colors ${course.isHidden ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 hover:text-blue-600'}`}
                            title={course.isHidden ? "Unhide Course" : "Hide Course"}
                          >
                            {course.isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          <button
                            onClick={() => setEditingCourse(course)}
                            className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"
                            title="Edit Level"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course.id, course.title)}
                            className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                            title="Delete Level"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex flex-col gap-1">
                          <button
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 hover:bg-slate-100 rounded-md disabled:opacity-20 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Move Up"
                          >
                            <ChevronUp size={20} />
                          </button>
                          <button
                            disabled={index === courses.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 hover:bg-slate-100 rounded-md disabled:opacity-20 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Move Down"
                          >
                            <ChevronDown size={20} />
                          </button>
                        </div>
                        <div className="h-10 w-px bg-slate-100 mx-2" />
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-500" />
                            <span className="text-sm font-bold text-slate-700">Sequence: {course.orderIndex || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-500">{course.estimatedTime}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                      <div className="flex flex-wrap gap-2">
                        {course.tags && course.tags.map((tag, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => navigate(`/admin/course/${course.id}/questions`)} // Updated onClick to navigate
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all" // Updated styling
                        >
                          <Briefcase size={14} /> Manage Question Bank {/* Updated icon */}
                        </button>
                        <button
                          onClick={() => navigate(`/course/${course.id}`)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10"
                        >
                          <ExternalLink size={14} /> Preview
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Zone */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Settings size={120} />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Core Architecture Tips</h3>
            <p className="text-indigo-100 text-sm leading-relaxed mb-6">
              Courses are defined by their levels and assessment banks. Changes made here propagate immediately to the student experience.
              Use the **Private** toggle to work on courses in draft mode before releasing them to the public.
            </p>
            <div className="flex gap-4">
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">Documentation</button>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">Asset Library</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals are kept as they are functional, but UI is updated via props/context if possible */}
      {(editingCourse || showCreateModal) && (
        <CourseEditModal
          course={editingCourse}
          onClose={() => {
            setEditingCourse(null);
            setShowCreateModal(false);
          }}
          onSave={handleSaveCourse}
        />
      )}

    </SaaSLayout>
  );
}
