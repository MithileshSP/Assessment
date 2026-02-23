import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Star, MessageSquare, CheckCircle, RefreshCw } from 'lucide-react';

export default function StudentFeedback() {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        difficulty: 3,
        clarity: 3,
        comments: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/feedback', {
                submissionId,
                ...formData
            });
            setSubmitted(true);
        } catch (error) {
            console.error('Feedback submission failed:', error);
            alert('Failed to submit feedback.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
                    <p className="text-gray-600 mb-8">
                        Your feedback helps us improve the assessment experience.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-blue-600 text-white rounded-lg py-3 font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-lg w-full">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Assessment Feedback</h1>
                    <p className="text-sm text-gray-600 mt-2">
                        Please rate your experience with this challenge.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Difficulty Rating (1-5)
                        </label>
                        <div className="flex gap-4 justify-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, difficulty: star })}
                                    className={`p-2 rounded-full transition-colors ${formData.difficulty >= star ? 'text-yellow-400' : 'text-gray-300'
                                        }`}
                                >
                                    <Star className="w-8 h-8 fill-current" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Clarity Rating (1-5)
                        </label>
                        <div className="flex gap-4 justify-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, clarity: star })}
                                    className={`p-2 rounded-full transition-colors ${formData.clarity >= star ? 'text-blue-400' : 'text-gray-300'
                                        }`}
                                >
                                    <MessageSquare className="w-8 h-8 fill-current" />
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-center text-gray-500 mt-1">
                            How clear were the instructions?
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Additional Comments
                        </label>
                        <textarea
                            value={formData.comments}
                            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-medium"
                            placeholder="Any issues or suggestions..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 text-white rounded-md font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Submit Feedback'}
                    </button>
                </form>
            </div>
        </div>
    );
}
