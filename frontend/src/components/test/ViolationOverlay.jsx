import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

/**
 * ViolationOverlay
 * 
 * Contract: Pure UI Component
 * - Displays the locked state.
 */
const ViolationOverlay = ({ isLocked, violations, maxViolations }) => {
    if (!isLocked) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6"
            onContextMenu={(e) => e.preventDefault()}
            style={{ userSelect: 'none' }}
        >
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-lg w-full animate-fade-in">
                <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                    <AlertTriangle size={48} />
                </div>
                <h2 className="text-3xl font-black text-red-600 mb-4">⚠️ TEST LOCKED ⚠️</h2>
                <p className="text-slate-700 font-bold mb-4">
                    Maximum security violations detected.
                </p>
                <p className="text-slate-500 text-sm mb-6">
                    Your code has been automatically saved. Do NOT close this browser or navigate away.
                </p>

                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-center gap-2 text-amber-800 text-sm font-bold mb-2">
                        <Clock size={18} className="animate-pulse" />
                        WAITING FOR ADMINISTRATOR
                    </div>
                    <p className="text-amber-700 text-xs">
                        An administrator will review your case and decide whether you can continue or if your work will be submitted as-is.
                    </p>
                </div>

                <div className="bg-slate-100 rounded-xl p-4 mb-4">
                    <p className="text-xs text-slate-500 font-mono">
                        Violations: <span className="text-red-600 font-bold">{violations}</span> / {maxViolations}
                    </p>
                </div>

                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                    🔒 Screen is locked • All actions are being monitored
                </p>
            </div>
        </div>
    );
};

export default React.memo(ViolationOverlay);
