import { useImperativeHandle, forwardRef, useRef, useEffect, useState } from "react";
import { Terminal, ChevronDown, ChevronUp, Trash2, Command, Loader2 } from "lucide-react";

/**
 * PreviewFrame - Renders student code in a sandboxed iframe
 * Handles both Web (live preview) and Node.js (execution detection)
 */
const PreviewFrame = forwardRef(({ code, isRestricted = false, onConsoleLog, isNodeJS = false }, ref) => {
  const iframeRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const scrollRef = useRef(null);
  const logCache = useRef(new Set());

  // Forward logs to parent when they change
  useEffect(() => {
    if (onConsoleLog) {
      onConsoleLog(logs);
    }
  }, [logs, onConsoleLog]);

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
    // SECURITY/CRASH FIX: Don't try to evaluate Node.js code in the browser iframe
    if (isNodeJS) {
      setLogs([{
        type: 'system',
        content: '[Notice] Browser preview disabled for Node.js code. Use "Run Code" to execute on server.',
        timestamp: new Date().toLocaleTimeString([], { hour12: true })
      }]);
      return;
    }

    setLogs([]); // Clear logs on refresh
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const document = iframe.contentDocument || iframe.contentWindow.document;

    // Inject base tag for assets or rewrite paths
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
    if (isNodeJS) return; // Skip auto-preview for Node.js challenges
    const timer = setTimeout(() => updatePreview(code), 400);
    return () => clearTimeout(timer);
  }, [code, isNodeJS]);

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

      <div className="flex-1 relative overflow-auto">
        <iframe ref={iframeRef} sandbox="allow-scripts allow-same-origin allow-modals allow-forms" className="w-full h-full" title="Preview" />
      </div>
    </div>
  );
});

PreviewFrame.displayName = "PreviewFrame";

export default PreviewFrame;
