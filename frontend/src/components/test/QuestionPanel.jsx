import React from 'react';

/**
 * QuestionPanel
 * 
 * Contract: Pure UI Component
 * - Displays question text, hints, and assets.
 */
const QuestionPanel = ({
    challenge,
    showInstructions,
    onToggleInstructions,
    currentQuestionIndex,
    totalQuestions,
    onNext,
    onPrev
}) => {
    if (!challenge) return null;

    return (
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
            <button
                onClick={onToggleInstructions}
                className="flex items-center justify-between px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
                <span className="font-semibold">
                    {showInstructions ? "📖 Hide Instructions" : "📖 Show Instructions"}
                </span>
                <svg
                    className={`w-5 h-5 transition-transform ${showInstructions ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {showInstructions && (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 mb-4 shadow-sm">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        Technical Protocol
                    </h2>

                    <div className="mb-8 question-desc whitespace-pre-wrap">
                        {challenge.description}
                    </div>

                    {challenge.instructions && challenge.instructions !== challenge.description && (
                        <div className="border-t border-slate-100 pt-8 supporting-content whitespace-pre-wrap">
                            {challenge.instructions}
                        </div>
                    )}

                    {/* Assets Section */}
                    {challenge.assets && (Array.isArray(challenge.assets) ? challenge.assets.length > 0 : challenge.assets.images?.length > 0) && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Resources
                            </h3>
                            <div className="space-y-2">
                                {(Array.isArray(challenge.assets) ? challenge.assets : challenge.assets?.images || []).map((asset, index) => {
                                    const assetPath = typeof asset === "string" ? asset : asset.path;
                                    const filename = assetPath.split("/").pop();
                                    let codePath = assetPath;
                                    if (!codePath.startsWith("http")) {
                                        codePath = codePath.startsWith("/") ? codePath.slice(1) : codePath;
                                        const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(codePath);
                                        if (isImage && !codePath.includes("images/") && !codePath.includes("assets/")) {
                                            codePath = `images/${codePath}`;
                                        }
                                        if (!codePath.startsWith("assets/")) {
                                            codePath = `assets/${codePath}`;
                                        }
                                        codePath = `/${codePath}`;
                                    }
                                    return (
                                        <div key={index} className="bg-white p-2 rounded border border-purple-100 flex items-center justify-between">
                                            <a href={codePath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate max-w-[200px]" title={filename}>
                                                {filename}
                                            </a>
                                            <code className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200 select-all">
                                                {codePath}
                                            </code>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Hints Section */}
                    {challenge.hints && challenge.hints.length > 0 && (
                        <details className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
                            <summary className="font-semibold text-yellow-900 cursor-pointer flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                💡 Hints ({challenge.hints.length})
                            </summary>
                            <div className="mt-3 space-y-2">
                                {challenge.hints.map((hint, index) => (
                                    <p key={index} className="text-sm text-yellow-800 pl-4 border-l-2 border-yellow-300">
                                        {index + 1}. {hint}
                                    </p>
                                ))}
                            </div>
                        </details>
                    )}
                    {/* Navigation and Progress */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onPrev}
                                disabled={currentQuestionIndex === 0}
                                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                            >
                                <span className="group-hover:-translate-x-1 transition-transform inline-block mr-1">←</span>
                                Previous
                            </button>
                            <button
                                onClick={onNext}
                                disabled={currentQuestionIndex === totalQuestions - 1}
                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                            >
                                Next
                                <span className="group-hover:translate-x-1 transition-transform inline-block ml-1">→</span>
                            </button>
                        </div>

                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Assessment Progress
                            </p>
                            <p className="text-sm font-black text-slate-900">
                                Question {currentQuestionIndex + 1} <span className="text-slate-300 mx-1">/</span> {totalQuestions}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(QuestionPanel);
