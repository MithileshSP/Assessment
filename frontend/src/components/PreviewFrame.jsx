import { useImperativeHandle, forwardRef, useRef, useEffect, useState } from "react";
import { Terminal, ChevronDown, ChevronUp, Trash2, Command, Loader2 } from "lucide-react";

/**
 * PreviewFrame - Renders student code in a sandboxed iframe
 * Handles both Web (live preview) and Node.js (execution detection)
 */
const PreviewFrame = forwardRef(({ code, isRestricted = false, onConsoleLog, isNodeJS = false, autoRun = false }, ref) => {
  const iframeRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // Force iframe refresh
  const [viewingFile, setViewingFile] = useState('index.html');
  const scrollRef = useRef(null);

  // Forward logs to parent when they change
  useEffect(() => {
    if (onConsoleLog) {
      onConsoleLog(logs);
    }
  }, [logs, onConsoleLog]);

  // Listen for terminal/console messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'CONSOLE_LOG') {
        const { logType, content } = event.data;
        // console.log("INTERNAL CAPTURE:", logType, content); // Debug
        setLogs(prev => [...prev.slice(-199), {
          type: logType,
          content,
          timestamp: new Date().toLocaleTimeString([], { hour12: true })
        }]);
        if (logType === 'error') setIsConsoleOpen(true);
      } else if (event.data && event.data.type === 'NAVIGATE_TO') {
        const target = event.data.file;
        setViewingFile(target);
        updatePreview(code); // Refresh with new file
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [code]);

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
    setPreviewKey(prev => prev + 1); // Force a completely new iframe mount to clear global scope
  };

  // When previewKey changes, wait for ref and update
  useEffect(() => {
    if (previewKey === 0 || !iframeRef.current || isNodeJS) return;

    const iframe = iframeRef.current;

    // 1. Prepare file map
    const allFiles = {
      'index.html': code.html || '',
      'styles.css': code.css || '',
      'script.js': code.js || '',
      ...(code.additionalFiles || {})
    };

    // 3. Determine content to show
    let mainHtml = allFiles[viewingFile] || allFiles['index.html'] || '';

    // 4. Transform Asset paths
    mainHtml = mainHtml
      .replace(/src=["'](?:http:\/\/localhost:5000)?\/?assets\/([^"']+)["']/g, `src="/assets/$1"`)
      .replace(/url\(["']?(?:http:\/\/localhost:5000)?\/?assets\/([^"']+)["']?\)/g, `url("/assets/$1")`)
      .replace(/src=["'](?!(?:http|\/|assets|images))([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']/g, `src="/assets/images/$1"`)
      .replace(/url\(["']?(?!(?:http|\/|assets|images))([^"']+\.(?:png|jpg|jpeg|gif|svg|webp))["']?\)/g, `url("/assets/images/$1")`);

    // 5. INLINE Internal Files (Replacing Blobs with direct content)
    Object.entries(allFiles).forEach(([name, content]) => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (name.endsWith('.css')) {
        // Replace <link rel="stylesheet" href="filename.css"> with <style>content</style>
        const linkRegex = new RegExp(`<link[^>]+href=["']([^"']*/)?${escapedName}["'][^>]*>`, 'g');
        mainHtml = mainHtml.replace(linkRegex, '<style data-file="' + name + '">' + content + '</style>');
      } else if (name.endsWith('.js')) {
        // Replace <script src="filename.js"></script> with <script>content</script>
        const scriptRegex = new RegExp(`<script[^>]+src=["']([^"']*/)?${escapedName}["'][^>]*>\\s*</script>`, 'g');
        mainHtml = mainHtml.replace(scriptRegex, '<script data-file="' + name + '">' + content.replace(/<\/script>/g, '<\\/script>') + '</script>');
      }
    });

    const helperScript = [
      '(function() {',
      '  window.__STUDENT_FILES__ = ' + JSON.stringify(allFiles).replace(/<\/script>/g, '<\\/script>') + ';',
      '  if (window._node_env_setup) return;',
      '  ',
      '  const _vfs = {',
      '    readFileSync: function(p) {',
      '      const cp = p.startsWith("./") ? p.slice(2) : p;',
      '      const res = window.__STUDENT_FILES__[cp];',
      '      if (res === undefined) throw new Error("File not found: " + p);',
      '      return res;',
      '    },',
      '    readdirSync: function(p) {',
      '      return Object.keys(window.__STUDENT_FILES__);',
      '    }',
      '  };',
      '',
      '  window._internalFs = _vfs;',
      '  window.require = function(m) {',
      '    if (m === "fs") return window._internalFs;',
      '    throw new Error("Module not found: " + m);',
      '  };',
      '',
      '  const _sp = (t, a) => {',
      '    window.parent.postMessage({',
      '      type: "CONSOLE_LOG",',
      '      logType: t,',
      '      content: Array.from(a).map(x => {',
      '        try { ',
      '          if (x === null) return "null";',
      '          if (x === undefined) return "undefined";',
      '          return typeof x === "object" ? JSON.stringify(x, null, 2) : String(x); ',
      '        }',
      '        catch (e) { return "[Circular or Non-Stringifiable]"; }',
      '      }).join(" ")',
      '    }, "*");',
      '  };',
      '',
      '  const ol = console.log;',
      '  console.log = function() { _sp("log", arguments); ol.apply(console, arguments); };',
      '  console.error = function() { _sp("error", arguments); ol.apply(console, arguments); };',
      '  console.warn = function() { _sp("warn", arguments); ol.apply(console, arguments); };',
      '  window.onerror = function(m) { _sp("error", [m]); };',
      '',
      '  document.addEventListener("click", e => {',
      '    const a = e.target.closest("a");',
      '    if (a && a.getAttribute("href")) {',
      '       const href = a.getAttribute("href").replace(/^\\.\\//, "");',
      '       if (window.__STUDENT_FILES__[href]) {',
      '         e.preventDefault();',
      '         window.parent.postMessage({ type: "NAVIGATE_TO", file: href }, "*");',
      '       }',
      '    }',
      '  });',
      '  ',
      '  window._node_env_setup = true;',
      '})();'
    ].join('\n');

    // Auto-inject missing core files if they weren't matched by name above
    const injectionTags = [];
    const hasStylesCss = mainHtml.includes('data-file="styles.css"');
    const hasScriptJs = mainHtml.includes('data-file="script.js"');

    if (!hasStylesCss && allFiles['styles.css']?.trim()) {
      injectionTags.push('<style>' + allFiles['styles.css'] + '</style>');
    }
    if (!hasScriptJs && allFiles['script.js']?.trim()) {
      injectionTags.push('<script>' + allFiles['script.js'].replace(/<\/script>/g, '<\\/script>') + '</script>');
    }

    const fullHTML = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <script>' + helperScript + '</script>',
      '</head>',
      '<body>',
      '  ' + mainHtml,
      '  ' + injectionTags.join('\n'),
      '</body>',
      '</html>'
    ].join('\n');

    iframe.srcdoc = fullHTML;
  }, [previewKey]);

  useImperativeHandle(ref, () => ({ updatePreview }));

  // Debounced auto-run (restored per user request for live preview)
  useEffect(() => {
    if (isNodeJS) return;

    // Immediate run on mount or if autoRun prop is true
    if (autoRun || previewKey === 0) {
      updatePreview(code);
      if (autoRun) return; // Don't setup timer if it's a static autoRun (like Expected)
    }

    const timer = setTimeout(() => {
      if (!isNodeJS) updatePreview(code);
    }, 1000);
    return () => clearTimeout(timer);
  }, [code, isNodeJS, autoRun]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div
      className="w-full h-full border border-slate-200 rounded-md overflow-hidden bg-white flex flex-col relative"
      onContextMenu={isRestricted ? (e) => e.preventDefault() : undefined}
      style={isRestricted ? { userSelect: 'none' } : undefined}
    >
      <div className="flex-1 relative overflow-auto">
        <iframe key={previewKey} ref={iframeRef} sandbox="allow-scripts allow-modals allow-forms" className="w-full h-full" title="Preview" />
      </div>
    </div>
  );
});

PreviewFrame.displayName = "PreviewFrame";

export default PreviewFrame;
