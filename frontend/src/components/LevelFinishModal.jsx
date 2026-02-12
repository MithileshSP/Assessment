
import React from 'react';
import { Award, FileText, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

export default function LevelFinishModal({ isOpen, onClose, score, maxScore = 100, isPassing }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 transform transition-all scale-100 p-6">

                <div className="text-center mb-6">
                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isPassing ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isPassing ? <Award size={32} /> : <FileText size={32} />}
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                        {isPassing ? 'Level Cleared!' : 'Level Failed'}
                    </h2>
                    <p className="text-slate-500">
                        {isPassing ? 'Great job! You have successfully completed this assessment.' : 'You did not meet the passing criteria for this level.'}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 mb-8 text-center border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Final Score</span>
                    <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-5xl font-black ${isPassing ? 'text-green-600' : 'text-slate-900'}`}>{score}</span>
                        <span className="text-lg font-bold text-slate-400">/{maxScore}</span>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                >
                    Return to Dashboard <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
}
