import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, getCourseLevels, getUserProgress } from '../services/api';
import { isAdminSessionActive } from '../utils/session';
import {
  ArrowLeft,
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
  Star
} from 'lucide-react';

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [levels, setLevels] = useState([]);
  const [userProgress, setUserProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    // Admin always has access
    if (isAdminSessionActive()) return 'unlocked';

    // Level 1 is always unlocked
    if (levelNumber === 1) return 'unlocked';

    // Check if user has completed previous level
    if (userProgress) {
      const courseProgress = userProgress.courses?.find(c => c.courseId === courseId);
      if (courseProgress) {
        const completedLevels = courseProgress.completedLevels || [];
        // Level is unlocked if previous level is completed or currentLevel already advanced
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Course not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-medium"
            >
              <ArrowLeft size={20} /> Back to Courses
            </button>
          </div>
        </div>
      </header>

      {/* Course Hero */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-8">
            {/* Course Icon/Thumbnail */}
            <div
              className="w-32 h-32 rounded-xl flex items-center justify-center text-6xl font-bold text-white shadow-lg overflow-hidden relative"
              style={{ backgroundColor: course.color }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black opacity-20"></div>
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-full h-full object-cover rounded-xl"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = `<span class="text-white opacity-90"><Code size={48} /></span>`;
                }}
              />
            </div>

            {/* Course Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                {course.title}
              </h1>
              <p className="text-xl text-gray-600 mb-4">{course.description}</p>

              <div className="flex gap-6 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <Clock class="text-indigo-600" size={20} />
                  <span className="font-medium">{course.estimatedTime}</span>
                </span>
                <span className="flex items-center gap-2 text-gray-600">
                  <Layers class="text-indigo-600" size={20} />
                  <span className="font-medium">{course.totalLevels} Levels</span>
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${course.difficulty === 'Beginner' ? 'bg-green-100 text-green-800' :
                  course.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                  <Zap size={14} /> {course.difficulty}
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {course.tags && course.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full border border-gray-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Levels Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <Layers size={28} className="text-gray-400" /> Course Levels
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {levels.map((level) => {
            const status = getLevelStatus(level.level);
            const isLocked = status === 'locked';
            const completed = isLevelCompleted(level.level);
            const isAdmin = isAdminSessionActive();

            const canAccess = isAdmin || (!isLocked && !completed);

            return (
              <div
                key={level.level}
                onClick={() => canAccess && navigate(`/level/${courseId}/${level.level}`)}
                className={`bg-white rounded-xl shadow-lg p-6 relative border border-gray-100 ${!canAccess
                  ? 'opacity-75 cursor-not-allowed bg-gray-50'
                  : 'cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl'
                  }`}
              >
                {/* Level Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Level {level.level}
                  </h3>
                  {isLocked ? (
                    <Lock size={28} className="text-gray-400" />
                  ) : completed ? (
                    <CheckCircle size={28} className="text-green-500" />
                  ) : (
                    <Target size={28} className="text-indigo-500" />
                  )}
                </div>

                {isLocked && !isAdmin && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                    <Lock size={16} className="text-yellow-700 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      Complete Level {level.level - 1} to unlock
                    </p>
                  </div>
                )}

                {completed && !isAdmin && (
                  <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                    <Award size={16} className="text-green-700 mt-0.5" />
                    <p className="text-sm text-green-800">
                      Level Cleared!
                    </p>
                  </div>
                )}

                {/* Questions Count */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600 flex items-center gap-2">
                    <FileText size={16} /> {level.totalQuestions} Question{level.totalQuestions !== 1 ? 's' : ''} Available
                  </span>
                </div>

                {/* Progress Bar (if any questions completed) */}
                {level.completedQuestions > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {level.completedQuestions}/{level.questions.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(level.completedQuestions / level.questions.length) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Questions Preview */}
                <div className="space-y-2">
                  {level.questions.slice(0, 3).map((q) => (
                    <div key={q.id} className="text-sm text-gray-600 flex items-center gap-2">
                      {q.completed ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="truncate">{q.title}</span>
                    </div>
                  ))}
                  {level.questions.length > 3 && (
                    <div className="text-sm text-gray-500 italic pl-5">
                      +{level.questions.length - 3} more...
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  disabled={!canAccess}
                  className={`w-full mt-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${!canAccess
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                >
                  {isLocked && !isAdmin ? <><Lock size={16} /> Locked</>
                    : completed && !isAdmin ? 'Level Cleared'
                      : isAdmin && completed ? 'Re-attempt (Admin)'
                        : <><PlayCircle size={16} /> Start Level</>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Star size={20} className="text-yellow-500" /> How it works
          </h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-3">
              <Target size={20} className="text-indigo-500 mt-0.5" />
              <span>Complete challenges in Level 1 to unlock Level 2</span>
            </li>
            <li className="flex items-start gap-3">
              <Code size={20} className="text-blue-500 mt-0.5" />
              <span>Write HTML/CSS code and see instant visual results</span>
            </li>
            <li className="flex items-start gap-3">
              <Star size={20} className="text-yellow-500 mt-0.5" />
              <span>Earn points for completing challenges</span>
            </li>
            <li className="flex items-start gap-3">
              <Award size={20} className="text-purple-500 mt-0.5" />
              <span>Complete all levels to master this course</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
