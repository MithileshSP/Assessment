
import React from 'react';
import { CheckCircle, ArrowRight, Clock } from 'lucide-react';

export default function SubmissionSuccessModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 transform transition-all scale-100 p-8 text-center">

                <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={40} className="text-green-600" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 mb-2">Assessment Submitted</h2>
                <p className="text-slate-500 mb-8">
                    Your code has been successfully saved and queued for faculty evaluation.
                    <br /><br />
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                        <Clock size={14} /> Result Pending
                    </span>
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                >
                    Return to Dashboard <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
}
