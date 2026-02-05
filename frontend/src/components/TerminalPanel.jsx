import { useRef, useEffect } from 'react';
import { Terminal, Trash2, ChevronDown, ChevronUp, Zap, Cpu, Play } from 'lucide-react';

/**
 * TerminalPanel - Integrated STDIN/Stdout UI for code execution
 * Matches user's requested redesign with separate input/output areas
 */
export default function TerminalPanel({
    output = [],
    onClear,
    isExpanded = true,
    onToggleExpand,
    stdin = "",
    setStdin,
    metrics = null // { executionTime, memoryUsage }
}) {
    const outputRef = useRef(null);

    // Auto-scroll to bottom when new output arrives
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    return (
        <div className={`flex flex-col bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden transition-all ${isExpanded ? 'h-full' : 'h-10'}`}>
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-blue-600" />
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Execution Environment</span>
                </div>
                <div className="flex items-center gap-2">
                    {output.length > 0 && (
                        <button
                            onClick={onClear}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            title="Clear output"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    <button
                        onClick={onToggleExpand}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-all"
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="flex-1 flex flex-col min-h-0 bg-white">
                    {/* STDIN Section */}
                    <div className="flex flex-col border-b border-gray-100">
                        <div className="px-4 py-2 bg-gray-50/50 flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">STDIN</label>
                            <span className="text-[9px] text-gray-400 italic font-medium">( Optional input for the program )</span>
                        </div>
                        <textarea
                            value={stdin}
                            onChange={(e) => setStdin(e.target.value)}
                            placeholder="Type input here... (e.g. 1 10\n3 7)"
                            className="w-full h-24 p-3 font-mono text-sm bg-gray-50/30 border-none focus:ring-0 resize-none text-gray-700 placeholder-gray-300"
                        />
                    </div>

                    {/* Output Section */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                            <label className="text-[10px] font-bold text-gray-800 uppercase tracking-widest">Output:</label>

                            {metrics && (
                                <div className="flex items-center gap-3 text-[10px] font-medium text-gray-400">
                                    <div className="flex items-center gap-1">
                                        <Zap size={10} className="text-yellow-500" />
                                        <span>{metrics.executionTime}ms</span>
                                    </div>
                                    <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                                        <Cpu size={10} className="text-blue-500" />
                                        <span>{metrics.memoryUsage || '44.5 MB'}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            ref={outputRef}
                            className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
                        >
                            {output.length === 0 ? (
                                <div className="text-gray-300 text-xs italic opacity-60 flex flex-col items-center justify-center h-full gap-2">
                                    <Play size={20} className="opacity-20" />
                                    <span>Run your code to see results...</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {output.map((line, index) => (
                                        <div
                                            key={index}
                                            className={`py-0.5 whitespace-pre-wrap break-all ${line.type === 'error'
                                                ? 'text-red-500 font-medium'
                                                : line.type === 'warn'
                                                    ? 'text-amber-500'
                                                    : line.type === 'info'
                                                        ? 'text-blue-500 italic'
                                                        : 'text-gray-700'
                                                }`}
                                        >
                                            {line.content}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
