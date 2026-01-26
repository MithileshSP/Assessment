import { useImperativeHandle, forwardRef, useRef, useEffect, useState } from "react";
import { Terminal, ChevronDown, ChevronUp, Trash2, Command, Loader2 } from "lucide-react";

const PreviewFrame = forwardRef(({ code, isRestricted = false }, ref) => {
  const iframeRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const scrollRef = useRef(null);
  const logCache = useRef(new Set());

  // Listen for terminal/console messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
        // Handle Console Logs
        if (event.data && event.data.type === 'CONSOLE_LOG') {
          const { logType, content } = event.data;
          const logKey = `${logType}:${content}`;
          const now = Date.now();

          // Strict Deduplication: skip if identical message logged in last 500ms
          if (logCache.current.has(logKey)) return;
          logCache.current.add(logKey);
          setTimeout(() => logCache.current.delete(logKey), 500);

          setLogs(prev => [...prev.slice(-99), {
            type: logType,
            content,
            timestamp: new Date().toLocaleTimeString([], { hour12: true }),
            rawTimestamp: now
          }]);
          if (logType === 'error') setIsConsoleOpen(true);
        }

        // Handle Input Requests (from prompt mock)
        if (event.data && event.data.type === 'PROMPT_REQUEST') {
          setIsWaitingForInput(true);
          setIsConsoleOpen(true);
          setLogs(prev => [...prev, {
            type: 'system',
            content: `[System] Input requested for: "${event.data.message}"`,
            timestamp: new Date().toLocaleTimeString([], { hour12: true })
          }]);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updatePreview = (codeToRender) => {
    setLogs([]); // Clear logs on refresh
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const document = iframe.contentDocument || iframe.contentWindow.document;

    // Inject base tag for assets or rewrite paths
    // We rewrite paths to use the root-relative /assets path, which Nginx proxies to the backend
    // This avoids CORS issues and works inside docker/dev environments consistently
    const processedHtml = (codeToRender.html || "")
      .replace(/src=["'](?:http:\/\/localhost:5000)?\/?assets\/([^"']+)["']/g, `src="/assets/$1"`)
      .replace(/url\(["']?(?:http:\/\/localhost:5000)?\/?assets\/([^"']+)["']?\)/g, `url("/assets/$1")`)
      .replace(/src=["'](?!(?:http|\/|assets|images))([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']/g, `src="/assets/images/$1"`)
      .replace(/url\(["']?(?!(?:http|\/|assets|images))([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']?\)/g, `url("/assets/images/$1")`);

    // Transform student JS to support async prompt()
    const studentJS = (codeToRender.js || "")
      .replace(/prompt\s*\(/g, 'await window.prompt(');

    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          ${codeToRender.css || ""}
        </style>
        <script>
          (function() {
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            const sendToParent = (type, args) => {
              window.parent.postMessage({
                type: 'CONSOLE_LOG',
                logType: type,
                content: Array.from(args).map(arg => {
                  try { return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg); }
                  catch (e) { return String(arg); }
                }).join(' ')
              }, '*');
            };

            console.log = function() { sendToParent('info', arguments); originalLog.apply(console, arguments); };
            console.error = function() { sendToParent('error', arguments); originalError.apply(console, arguments); };
            console.warn = function() { sendToParent('warn', arguments); originalWarn.apply(console, arguments); };

            // Async Prompt Mock
            window.prompt = function(msg) {
              return new Promise(resolve => {
                window.parent.postMessage({ type: 'PROMPT_REQUEST', message: msg }, '*');
                const handler = (e) => {
                  if (e.data.type === 'PROMPT_RESPONSE') {
                    window.removeEventListener('message', handler);
                    resolve(e.data.value);
                  }
                };
                window.addEventListener('message', handler);
              });
            };

            window.onerror = function(msg) { sendToParent('error', [msg]); };

            window.addEventListener('message', (e) => {
              if (e.data.type === 'EXEC_CMD') {
                try {
                  const result = window.eval(e.data.code);
                  if (result !== undefined) console.log('=> ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : result));
                } catch (err) { console.error(err.message); }
              }
            });
          })();
        </script>
      </head>
      <body>
        ${processedHtml}
        <script>
          (async () => {
            try {
              ${studentJS}
            } catch (error) {
              console.error('Runtime Error:', error);
            }
          })();
        </script>
      </body>
      </html>
    `;

    document.open();
    document.write(fullHTML);
    document.close();
  };

  useImperativeHandle(ref, () => ({ updatePreview }));

  // Debounced run code to prevent flickering during editing
  useEffect(() => {
    const timer = setTimeout(() => updatePreview(code), 400);
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!commandInput.trim() || !iframeRef.current) return;

    const value = commandInput.trim();
    setLogs(prev => [...prev, {
      type: 'input',
      content: value,
      timestamp: new Date().toLocaleTimeString([], { hour12: true })
    }]);

    if (isWaitingForInput) {
      setIsWaitingForInput(false);
      iframeRef.current.contentWindow.postMessage({ type: 'PROMPT_RESPONSE', value }, '*');
    } else {
      iframeRef.current.contentWindow.postMessage({ type: 'EXEC_CMD', code: value }, '*');
    }

    setHistory(prev => [value, ...prev].slice(0, 50));
    setCommandInput("");
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = historyIndex + 1;
      if (nextIndex < history.length) {
        setHistoryIndex(nextIndex);
        setCommandInput(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setCommandInput(history[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    }
  };

  return (
    <div
      className="w-full h-full border-2 border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col relative shadow-sm"
      onContextMenu={isRestricted ? (e) => e.preventDefault() : undefined}
      style={isRestricted ? { userSelect: 'none' } : undefined}
    >
      <div className="flex-1 relative overflow-auto">
        <iframe ref={iframeRef} sandbox="allow-scripts allow-same-origin allow-modals allow-forms" className="w-full h-full" title="Preview" />
      </div>

      {/* Terminal UI */}
      <div className={`transition-all duration-300 flex flex-col ${isConsoleOpen ? 'h-72' : 'h-10'} bg-[#1e1e1e] text-slate-300`}>
        <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#2d2d2d] border-t border-[#333] select-none" onClick={() => setIsConsoleOpen(!isConsoleOpen)}>
          <div className="flex items-center gap-2">
            <Terminal size={14} className={isConsoleOpen ? "text-blue-400" : "text-slate-500"} />
            <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Terminal Output</span>
            {logs.length > 0 && !isConsoleOpen && <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-black">{logs.length} items</span>}
          </div>
          <div className="flex items-center gap-4">
            {isConsoleOpen && <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} className="text-slate-500 hover:text-white transition-colors" title="Clear Terminal"><Trash2 size={13} /></button>}
            {isConsoleOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </div>

        {isConsoleOpen && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d]">
            <div ref={scrollRef} className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic opacity-50">Terminal ready...</div>
              ) : (
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={i} className={`flex items-start gap-3 ${log.type === 'error' ? 'text-red-400' :
                      log.type === 'warn' ? 'text-yellow-400' :
                        log.type === 'input' ? 'text-blue-400 font-bold' :
                          log.type === 'system' ? 'text-purple-400 italic' :
                            'text-green-400'
                      }`}>
                      <span className="text-slate-700 min-w-[75px] text-[10px] mt-1 select-none">[{log.timestamp}]</span>
                      <span className="whitespace-pre-wrap break-all">{log.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-[#333] bg-[#1a1a1a]">
              <span className={`font-black font-mono text-base mt-0.5 ${isWaitingForInput ? 'text-orange-500 animate-pulse' : 'text-blue-500'}`}>
                {isWaitingForInput ? '?' : '❯'}
              </span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isWaitingForInput ? "Waiting for input..." : "Type JS command..."}
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-[13px] placeholder-slate-600"
                autoFocus
              />
              {isWaitingForInput && <Loader2 size={14} className="text-orange-500 animate-spin" />}
              <Command size={12} className="text-slate-500" />
            </form>
          </div>
        )}
      </div>
    </div>
  );
});

PreviewFrame.displayName = "PreviewFrame";

export default PreviewFrame;
