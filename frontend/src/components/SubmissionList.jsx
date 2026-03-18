import { useState } from 'react';
import {
  BarChart2,
  Image as ImageIcon,
  Camera,
  CheckCircle,
  Search,
  TrendingUp,
  Layout,
  Palette,
  Lightbulb,
  MessageCircle,
  User,
  FileText,
  Clock,
  Hash,
  Download,
  Trash2,
  Play,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Info,
  X,
  XCircle
} from 'lucide-react';

export default function SubmissionList({ submissions, onReEvaluate, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };



  const getStatusBadge = (status) => {
    const classes = {
      passed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${classes[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No submissions yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">


      {submissions.map((submission) => (
        <div key={submission.id} className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900">
                {submission.candidateName}
              </h3>
              <p className="text-sm text-gray-600">
                Challenge ID: {submission.challengeId}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Submitted: {formatDate(submission.submittedAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(submission.status)}
              {submission.result && (
                <div className="text-2xl font-bold text-blue-600">
                  {submission.result.finalScore}%
                </div>
              )}
            </div>
          </div>

          {submission.result && (
              <div className="bg-gray-50 rounded p-3 col-span-2">
                <div className="text-xs text-gray-600">Structure Score</div>
                <div className="text-xl font-bold text-blue-600">
                  {submission.result.structureScore}%
                </div>
              </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
            >
              {expandedId === submission.id ? <><ChevronDown size={16} /> Hide Details</> : <><Play size={16} /> View Code Details</>}
            </button>
            <button
              onClick={() => onReEvaluate(submission.id)}
              className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
            >
              <RefreshCw size={16} /> Re-evaluate
            </button>
            <button
              onClick={() => onDelete(submission.id)}
              className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>

          {expandedId === submission.id && (
            <div className="mt-4 space-y-6">
              {/* Summary Card */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart2 size={20} /> Submission Details
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-xs text-gray-600 mb-1">Final Score</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {submission.result?.finalScore || submission.total_score || 0}%
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm col-span-2">
                    <div className="text-xs text-gray-600 mb-1">Structure</div>
                    <div className="text-2xl font-bold text-green-600">
                      {submission.result?.structureScore || 0}%
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-xs text-gray-600 mb-1">Status</div>
                    <div className="text-xl font-bold flex items-center gap-2">
                      {submission.status === 'passed' ? (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle size={20} /> PASSED</span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1"><XCircle size={20} /> FAILED</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 flex items-center gap-1"><User size={14} /> Candidate:</span>
                    <span className="font-semibold text-gray-900">{submission.candidateName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 flex items-center gap-1"><FileText size={14} /> Challenge:</span>
                    <span className="font-semibold text-gray-900">{submission.challengeId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 flex items-center gap-1"><Clock size={14} /> Submitted:</span>
                    <span className="font-semibold text-gray-900">{formatDate(submission.submittedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 flex items-center gap-1"><Hash size={14} /> ID:</span>
                    <span className="font-mono text-xs text-gray-600">{submission.id}</span>
                  </div>
                </div>
              </div>



              {/* Code Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <Play size={20} /> Submitted Code
                  <span className="ml-auto text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                    {submission.code.html ? 'HTML' : ''}
                    {submission.code.css ? ' • CSS' : ''}
                    {submission.code.js ? ' • JS' : ''}
                  </span>
                </h4>

                <div className="space-y-4">
                  {/* HTML Code */}
                  {submission.code.html && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                        <span className="text-gray-700 font-bold text-sm">📄 HTML</span>
                        <span className="ml-auto text-xs text-gray-600">
                          {submission.code.html.split('\n').length} lines
                        </span>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 text-sm overflow-x-auto max-h-96 overflow-y-auto">
                        <code>{submission.code.html}</code>
                      </pre>
                    </div>
                  )}

                  {/* CSS Code */}
                  {submission.code.css && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                        <span className="text-gray-700 font-bold text-sm">🎨 CSS</span>
                        <span className="ml-auto text-xs text-gray-600">
                          {submission.code.css.split('\n').length} lines
                        </span>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 text-sm overflow-x-auto max-h-96 overflow-y-auto">
                        <code>{submission.code.css}</code>
                      </pre>
                    </div>
                  )}

                  {/* JavaScript Code */}
                  {submission.code.js && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                        <span className="text-gray-700 font-bold text-sm">⚡ JavaScript</span>
                        <span className="ml-auto text-xs text-gray-600">
                          {submission.code.js.split('\n').length} lines
                        </span>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 text-sm overflow-x-auto max-h-96 overflow-y-auto">
                        <code>{submission.code.js}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Evaluation Results */}
              {submission.result && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} /> Detailed Evaluation Results
                  </h4>

                  <div className="space-y-4">
                    {/* Structure Analysis */}
                    {submission.result.structure && (
                      <div className="border-l-4 border-green-500 pl-4">
                        <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          <Layout size={18} /> Structure Analysis
                          <span className="ml-2 text-sm font-bold text-green-600">
                            {submission.result.structureScore}%
                          </span>
                        </h5>
                        <div className="text-sm text-gray-700 space-y-1">
                          {submission.result.structure.missingTags?.length > 0 && (
                            <div>
                              <span className="font-medium">Missing Tags:</span>
                              <span className="ml-2 text-red-600">
                                {submission.result.structure.missingTags.join(', ')}
                              </span>
                            </div>
                          )}
                          {submission.result.structure.extraTags?.length > 0 && (
                            <div>
                              <span className="font-medium">Extra Tags:</span>
                              <span className="ml-2 text-orange-600">
                                {submission.result.structure.extraTags.join(', ')}
                              </span>
                            </div>
                          )}
                          {submission.result.structure.matchedTags?.length > 0 && (
                            <div>
                              <span className="font-medium">Matched Tags:</span>
                              <span className="ml-2 text-green-600">
                                {submission.result.structure.matchedTags.length} correct
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}



                    {/* Raw Result Data (for debugging) */}
                    <details className="bg-gray-50 rounded p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-2">
                        <Search size={14} /> View Raw Evaluation Data (JSON)
                      </summary>
                      <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(submission.result, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}

              {/* Feedback Section */}
              {submission.result && submission.result.feedback && submission.result.feedback.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb size={20} /> Evaluation Feedback
                  </h4>
                  <ul className="space-y-2">
                    {submission.result.feedback.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-lg">{item.type === 'success' ? <CheckCircle size={16} /> : item.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}</span>
                        <span className="text-gray-700">{item.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* User Feedback Section */}
              {submission.user_feedback && (
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageCircle size={20} /> User Feedback
                  </h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{submission.user_feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
