import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api, { getLevelQuestions, getUserSubmissions } from '../services/api';

export default function LevelResults() {
  const { courseId, level } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?.id || 'default-user';

  const [results, setResults] = useState([]);
  const [levelUnlocked, setLevelUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateResults();
  }, [courseId, level]);

  const calculateResults = async () => {
    try {
      setLoading(true);
      let { submissions, assignedQuestions } = location.state || {};

      // If state is missing, fetch from API
      if (!submissions || !assignedQuestions) {
        const [questionsRes, submissionsRes] = await Promise.all([
          getLevelQuestions(courseId, level, userId),
          getUserSubmissions(userId)
        ]);

        assignedQuestions = questionsRes.data;

        // Map submissions to matching questions (keyed by challenge_id)
        const subMap = {};
        // submissionsRes.data is expected to be an array of submissions from newest to oldest
        submissionsRes.data.forEach(s => {
          if (s.courseId === courseId && s.level === parseInt(level)) {
            // Only capture the most recent submission per challenge
            if (!subMap[s.challengeId]) {
              subMap[s.challengeId] = s;
            }
          }
        });
        submissions = subMap;
      }

      if (!assignedQuestions || assignedQuestions.length === 0) {
        navigate(`/course/${courseId}`);
        return;
      }

      // Calculate results
      const resultsData = assignedQuestions.map((q, index) => {
        const submission = submissions[q.id];
        const isGraded = submission?.manual_score !== null && submission?.manual_score !== undefined;

        // Extract internal result if it's a JSON string or object
        let internalResult = submission?.evaluation_result;
        if (typeof internalResult === 'string') {
          try { internalResult = JSON.parse(internalResult); } catch (e) { internalResult = {}; }
        }

        return {
          questionNumber: index + 1,
          title: q.title,
          score: isGraded ? submission.manual_score : (internalResult?.finalScore || submission?.final_score || 0),
          passed: isGraded ? (submission.manual_score >= 50) : (submission?.status === 'passed' || internalResult?.passed),
          feedback: internalResult || null,
          isPending: !isGraded && submission?.status === 'pending',
          manualFeedback: submission?.manual_feedback || null
        };
      });

      setResults(resultsData);

      // Check if level should be unlocked
      const anyPending = resultsData.some(r => r.isPending);
      const allPassed = resultsData.every(r => r.passed);
      const totalScore = resultsData.reduce((sum, r) => sum + r.score, 0);
      const avgScore = totalScore / (resultsData.length || 1);

      if (!anyPending && (allPassed || avgScore >= 70)) {
        // Mark level as complete and unlock next level
        await api.post('/users/complete-level', {
          userId,
          courseId,
          level: parseInt(level)
        });
        setLevelUnlocked(true);
      } else {
        setLevelUnlocked(false);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to calculate results:', error);
      setLoading(false);
    }
  };

  const getTotalScore = () => {
    const total = results.reduce((sum, r) => sum + r.score, 0);
    return (total / results.length).toFixed(1);
  };

  const getPassedCount = () => {
    return results.filter(r => r.passed).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Calculating results...</p>
        </div>
      </div>
    );
  }

  const totalScore = parseFloat(getTotalScore());
  const passedCount = getPassedCount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Results Header */}
        <div className={`rounded-xl shadow-2xl p-8 mb-8 ${levelUnlocked
          ? 'bg-gradient-to-r from-green-500 to-green-600'
          : 'bg-gradient-to-r from-orange-500 to-orange-600'
          } text-white`}>
          <div className="text-center">
            <div className="text-6xl mb-4">
              {levelUnlocked ? '🎉' : '📝'}
            </div>
            <h1 className="text-4xl font-bold mb-2">
              Level {level} {levelUnlocked ? 'Complete!' : results.some(r => r.isPending) ? 'Evaluation Pending' : 'Results'}
            </h1>
            <p className="text-xl opacity-90">
              {levelUnlocked
                ? `Congratulations! You've unlocked Level ${parseInt(level) + 1}!`
                : results.some(r => r.isPending)
                  ? 'Your submission is being reviewed by our faculty.'
                  : 'Review your performance below'}
            </p>
          </div>

          {/* Score Summary */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">{totalScore}%</div>
              <div className="text-sm opacity-90 mt-1">Average Score</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">{passedCount}/{results.length}</div>
              <div className="text-sm opacity-90 mt-1">Questions Passed</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">
                {results.some(r => r.isPending) ? '⏳' : (levelUnlocked ? '✓' : '✗')}
              </div>
              <div className="text-sm opacity-90 mt-1">
                {results.some(r => r.isPending) ? 'Pending Review' : (levelUnlocked ? 'Level Unlocked' : 'Try Again')}
              </div>
            </div>
          </div>
        </div>

        {/* Individual Question Results */}
        <div className="space-y-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Question Breakdown</h2>

          {results.map((result, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${result.passed ? 'border-green-500' : 'border-red-500'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    Q{result.questionNumber}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800">{result.title}</h3>
                    <p className={`text-sm ${result.isPending ? 'text-blue-600' : (result.passed ? 'text-green-600' : 'text-red-600')}`}>
                      {result.isPending ? '⏳ Pending Faculty Review' : (result.passed ? '✓ Passed' : '✗ Not Passed')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800">
                    {result.isPending ? '--' : `${result.score}%`}
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.isPending ? 'Awaiting Score' : 'Final Score'}
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              {result.feedback && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-blue-600">
                      {result.feedback.technical?.structure?.score || 0}%
                    </div>
                    <div className="text-xs text-gray-600">Structure</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-purple-600">
                      {result.feedback.technical?.visual || 0}%
                    </div>
                    <div className="text-xs text-gray-600">Visual</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-green-600">
                      {result.feedback.technical?.behavior || 0}%
                    </div>
                    <div className="text-xs text-gray-600">Behavior</div>
                  </div>
                </div>
              )}

              {/* Manual Feedback */}
              {result.manualFeedback && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <h4 className="text-sm font-bold text-blue-800 mb-1 uppercase tracking-wider">Faculty Feedback</h4>
                  <p className="text-sm text-blue-900 leading-relaxed">{result.manualFeedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate(`/course/${courseId}`)}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            Back to Course
          </button>

          {!levelUnlocked && (
            <button
              onClick={() => navigate(`/level/${courseId}/${level}`)}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          )}

          {levelUnlocked && (
            <button
              onClick={() => navigate(`/level/${courseId}/${parseInt(level) + 1}`)}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Start Level {parseInt(level) + 1} →
            </button>
          )}
        </div>

        {/* Progress Info */}
        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
            {levelUnlocked
              ? `Great job! Keep up the momentum in Level ${parseInt(level) + 1}!`
              : 'Complete both questions with passing scores to unlock the next level.'}
          </p>
        </div>
      </div>
    </div>
  );
}
