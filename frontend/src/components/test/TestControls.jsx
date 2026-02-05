import React from 'react';
import { CheckCircle, Play, Check, RefreshCw } from 'lucide-react';

/**
 * TestControls
 * 
 * Contract: Controller-Aware Component
 * - Receives callbacks.
 * - Never owns logic.
 */
const TestControls = ({
    onRun,
    onSubmit,
    onFinish,
    canFinish,
    isSubmitting,
    isEvaluating,
    isFinishing,
    isSaving
}) => {
    return (
        <div className="flex gap-3">
            {canFinish && (
                <button
                    onClick={onFinish}
                    disabled={isFinishing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isFinishing ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                    {isFinishing ? "Finishing..." : "Finish & View Results"}
                </button>
            )}

            <button onClick={onRun} className="btn-secondary flex items-center gap-2">
                <Play size={18} />
                Run Code
            </button>

            <button
                onClick={onSubmit}
                disabled={isSubmitting || isEvaluating || isSaving || isFinishing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isSubmitting || isEvaluating ? (
                    <>
                        <RefreshCw size={20} className="animate-spin" />
                        Running...
                    </>
                ) : (
                    <>
                        <Check size={20} />
                        Submit Code
                    </>
                )}
            </button>
        </div>
    );
};

export default React.memo(TestControls);
