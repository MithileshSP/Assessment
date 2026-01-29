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
  const scrollRef = useRef(null);
  const logCache = useRef(new Set());
  const blobUrls = useRef({});

  // Cleanup Blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrls.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updatePreview = (codeToRender) => {
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
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    // 1. Revoke old Blob URLs
    Object.values(blobUrls.current).forEach(url => URL.revokeObjectURL(url));
    blobUrls.current = {};

    // 2. Prepare file map
    const allFiles = {
      'styles.css': codeToRender.css || '',
      'script.js': codeToRender.js || '',
      ...(codeToRender.additionalFiles || {})
    };

    // 3. Create Blob URLs for all files
    Object.entries(allFiles).forEach(([name, content]) => {
      const type = name.endsWith('.css') ? 'text/css' : (name.endsWith('.js') ? 'text/javascript' : 'text/plain');
      const blob = new Blob([content], { type });
      blobUrls.current[name] = URL.createObjectURL(blob);
    });

    // 4. Transform HTML - Replace file references with Blob URLs
    let processedHtml = codeToRender.html || '';

    // Handle Asset paths (backward compatibility)
    processedHtml = processedHtml
      .replace(/src=["'](?:http:\/\/localhost:5000)?\/?assets\/([^"']+)["']/g, `src="/assets/$1"`)
      .replace(/url\(["']?(?:http:\/\/localhost:5000)?\/?assets\/([^"']+)["']?\)/g, `url("/assets/$1")`)
      .replace(/src=["'](?!(?:http|\/|assets|images))([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']/g, `src="/assets/images/$1"`)
      .replace(/url\(["']?(?!(?:http|\/|assets|images))([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']?\)/g, `url("/assets/images/$1")`);

    // Replace internal file references (script src and link href)
    Object.entries(blobUrls.current).forEach(([name, url]) => {
      // Escape name for regex
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Replace <script src="name"> or <script src="./name">
      const scriptRegex = new RegExp(`(<script[^>]+src=["'])(?:\\.\\/)?${escapedName}(["'][^>]*>)`, 'g');
      processedHtml = processedHtml.replace(scriptRegex, `$1${url}$2`);

      // Replace <link[^>]+href="name"> or <link[^>]+href="./name">
      const linkRegex = new RegExp(`(<link[^>]+href=["'])(?:\\.\\/)?${escapedName}(["'][^>]*>)`, 'g');
      processedHtml = processedHtml.replace(linkRegex, `$1${url}$2`);
    });

    // 5. Build full HTML with helper scripts
    const helperScript = `
      (function() {
        const studentFiles = ${JSON.stringify(allFiles)};
        window.__STUDENT_FILES__ = studentFiles;

        // Mock fs module
        const fsMock = {
          readFileSync: function(path, options) {
            // Clean path (remove ./ if present)
            const cleanPath = path.startsWith('./') ? path.slice(2) : path;
            const content = studentFiles[cleanPath];
            if (content === undefined) {
              throw new Error("File not found: " + path);
            }
            return content;
          },
          readdirSync: function(path) {
            if (path === '.' || path === './') {
              return Object.keys(studentFiles);
            }
            // Basic support for deeper paths if needed
            const prefix = path.endsWith('/') ? path : path + '/';
            const cleanPrefix = prefix.startsWith('./') ? prefix.slice(2) : prefix;
            return Object.keys(studentFiles)
              .filter(f => f.startsWith(cleanPrefix))
              .map(f => f.slice(cleanPrefix.length).split('/')[0]);
          },
          exists: function(path) {
             const cleanPath = path.startsWith('./') ? path.slice(2) : path;
             return studentFiles[cleanPath] !== undefined;
          }
        };

        window.fs = fsMock;

        // Mock require for basic node-like support
        window.require = function(moduleName) {
          if (moduleName === 'fs') return fsMock;
          throw new Error("Module not found: " + moduleName);
        };

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
        window.onerror = function(msg) { sendToParent('error', [msg]); };

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

        window.addEventListener('message', (e) => {
          if (e.data.type === 'EXEC_CMD') {
            try {
              const result = window.eval(e.data.code);
              if (result !== undefined) console.log('=> ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : result));
            } catch (err) { console.error(err.message); }
          }
        });
      })();
    `;

    // Determine if we need to inject default script/style (if not already linked)
    const hasScriptJs = new RegExp(`<script[^>]+src=["'][^"']*${blobUrls.current['script.js']}["']`, 'i').test(processedHtml);
    const hasStylesCss = new RegExp(`<link[^>]+href=["'][^"']*${blobUrls.current['styles.css']}["']`, 'i').test(processedHtml);

    const injectionTags = [];
    if (!hasStylesCss && allFiles['styles.css'].trim()) {
      injectionTags.push(`<link rel="stylesheet" href="${blobUrls.current['styles.css']}">`);
    }
    if (!hasScriptJs && allFiles['script.js'].trim()) {
      injectionTags.push(`<script src="${blobUrls.current['script.js']}"></script>`);
    }

    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        </style>
        <script>${helperScript}</script>
      </head>
      <body>
        ${processedHtml}
        ${injectionTags.join('\n')}
      </body>
      </html>
    `;

    doc.open();
    doc.write(fullHTML);
    doc.close();
  };

  useImperativeHandle(ref, () => ({ updatePreview }));

  // Debounced run code to prevent flickering during editing
  useEffect(() => {
    if (isNodeJS) return;
    const timer = setTimeout(() => updatePreview(code), 400);
    return () => clearTimeout(timer);
  }, [code, isNodeJS]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div
      className="w-full h-full border-2 border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col relative shadow-sm"
      onContextMenu={isRestricted ? (e) => e.preventDefault() : undefined}
      style={isRestricted ? { userSelect: 'none' } : undefined}
    >
      <div className="flex-1 relative overflow-auto">
        <iframe ref={iframeRef} sandbox="allow-scripts allow-same-origin allow-modals allow-forms" className="w-full h-full" title="Preview" />
      </div>
    </div>
  );
});

PreviewFrame.displayName = "PreviewFrame";

export default PreviewFrame;
