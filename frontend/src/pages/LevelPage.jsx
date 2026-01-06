import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, getLevelQuestions } from '../services/api';
import {
  ArrowLeft,
  Dices,
  FileText,
  CheckCircle,
  Star,
  Image,
  Paperclip,
  Lightbulb,
  PlayCircle,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function LevelPage() {
  const { courseId, level } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLevelData();
  }, [courseId, level]);

  const loadLevelData = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'default-user';

      const [courseRes, questionsRes] = await Promise.all([
        getCourse(courseId),
        getLevelQuestions(courseId, level, userId) // Pass userId to get assigned questions
      ]);
      setCourse(courseRes.data);
      setQuestions(questionsRes.data); // Will be only 2 random questions
    } catch (error) {
      console.error('Failed to load level:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading level...</p>
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
              onClick={() => navigate(`/course/${courseId}`)}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-medium"
            >
              <ArrowLeft size={20} /> Back to {course?.title}
            </button>
            <div className="text-xl font-bold text-gray-900">
              Level {level}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            {/* Note: course.icon is still likely text emoji if from DB, but we wrap it carefully or replace in future DB updates */}
            {course?.icon} Level {level} Challenges
          </h1>
          <p className="text-gray-600 mb-2">
            Complete both challenges to unlock the next level
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 flex items-start gap-3">
            <Dices className="text-blue-600 mt-0.5" size={20} />
            <p className="text-sm text-blue-800">
              <strong>Randomized Questions:</strong> You've been assigned <strong>{questions.length} random questions</strong> from the question bank for this level.
              Complete both to progress!
            </p>
          </div>
        </div>

        {/* Questions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questions.map((question, index) => {
            const isCompleted = question.isCompleted || false;

            return (
              <div
                key={question.id}
                onClick={() => navigate(`/challenge/${question.id}`)}
                className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                {/* Question Header */}
                <div
                  className="h-3"
                  style={{ backgroundColor: course?.color }}
                ></div>

                <div className="p-6">
                  {/* Title and Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-gray-500">
                          #{index + 1}
                        </span>
                        {isCompleted ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                            <CheckCircle size={14} /> Completed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-sm font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
                            <FileText size={14} /> Not Started
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {question.title}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {question.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Star size={16} className="text-yellow-500" /> {question.points} pts</span>
                      {question.assets?.images?.length > 0 && (
                        <span className="flex items-center gap-1"><Image size={16} className="text-indigo-500" /> {question.assets.images.length} asset{question.assets.images.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Assets Preview */}
                  {question.assets?.images?.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-600 mb-2 font-medium">Assets included:</div>
                      <div className="flex flex-wrap gap-2">
                        {question.assets.images.map((img, idx) => (
                          <div key={idx} className="px-2 py-1 bg-gray-50 border border-gray-200 text-xs text-gray-600 rounded flex items-center gap-1">
                            <Paperclip size={12} /> {img.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hints */}
                  {question.hints?.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Lightbulb size={16} className="text-yellow-500" /> {question.hints.length} hint{question.hints.length !== 1 ? 's' : ''} available
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${isCompleted
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                  >
                    {isCompleted
                      ? <><CheckCircle size={18} /> Completed - Review</>
                      : <><PlayCircle size={18} /> Start Challenge</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {questions.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
              <HelpCircle size={48} className="text-gray-400" />
            </div>
            <p className="text-xl text-gray-600 mb-4">No challenges in this level yet</p>
            <button
              onClick={() => navigate(`/course/${courseId}`)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Back to Course
            </button>
          </div>
        )}

        {/* Progress Summary */}
        {questions.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Start size={20} className="text-indigo-600" /> Level Progress
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-gray-900">
                {questions.filter(q => q.isCompleted).length} / {questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${(questions.filter(q => q.isCompleted).length / questions.length) * 100}%`
                }}
              ></div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              {questions.filter(q => q.isCompleted).length === questions.length ? (
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle size={16} /> Level Complete! Next level unlocked.
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle size={16} /> Complete all challenges to unlock Level {parseInt(level) + 1}
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
