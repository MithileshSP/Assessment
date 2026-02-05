import React from 'react';
import { Clock, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * TestHeader
 * 
 * Contract: Pure UI Component
 * - Receives props for display.
 * - No internal side effects or hooks.
 */
const TestHeader = ({
    title,
    level,
    timeRemaining,
    formatTime,
    saveStatus,
    lastSaveTime
}) => {
    const isTimeLow = timeRemaining <= 300;

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
            <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{title}</h1>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-mono rounded border border-slate-200">
                                BUILD: v2.7-MODULAR
                            </span>
                        </div>
                        <p className="text-gray-600">Level {level}</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Timer */}
                        {timeRemaining !== null && (
                            <div
                                className={`px-5 py-2.5 rounded-2xl border font-display font-black text-sm flex items-center gap-3 shadow-sm transition-all duration-300 ${isTimeLow
                                        ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                                        : "bg-slate-900 border-slate-800 text-white"
                                    }`}
                            >
                                <Clock size={18} className={isTimeLow ? "text-rose-600" : "text-blue-400"} />
                                <span className="tracking-widest">{formatTime()}</span>
                            </div>
                        )}

                        {/* Sync Status */}
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                            {saveStatus === 'saving' && (
                                <>
                                    <RefreshCw size={14} className="animate-spin text-blue-600" />
                                    <span className="text-blue-600">Syncing...</span>
                                </>
                            )}
                            {saveStatus === 'saved' && (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-slate-500">
                                        Saved {lastSaveTime ? lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </>
                            )}
                            {saveStatus === 'error' && (
                                <>
                                    <AlertTriangle size={14} className="text-rose-500" />
                                    <span className="text-rose-500">Sync Failed</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default React.memo(TestHeader);
