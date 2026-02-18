import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { Plus, X, Edit3, File, FileText, Code, Palette } from 'lucide-react';

/**
 * MultiFileEditor - A code editor with dynamic file tabs
 * Backward compatible with legacy code={html, css, js} format
 * Supports: HTML, CSS, JS, and TXT files
 * Features: Add, rename, delete files
 */
const MultiFileEditor = ({
    code = { html: '', css: '', js: '' },
    onChange,
    readOnly = false,
    restrictions
}) => {
    // Map legacy code format to files format
    const codeToFiles = (codeObj) => ({
        'index.html': codeObj.html || '',
        'style.css': codeObj.css || '',
        'script.js': codeObj.js || '',
        ...(codeObj.additionalFiles || {})
    });

    // Map files back to legacy format
    const filesToCode = (filesObj) => ({
        html: filesObj['index.html'] || '',
        css: filesObj['style.css'] || '',
        js: filesObj['script.js'] || '',
        additionalFiles: Object.fromEntries(
            Object.entries(filesObj).filter(([name]) =>
                !['index.html', 'style.css', 'script.js'].includes(name)
            )
        )
    });

    const [files, setFiles] = useState(codeToFiles(code));
    const [activeFile, setActiveFile] = useState('index.html');
    const [renamingFile, setRenamingFile] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const renameInputRef = useRef(null);
    const addButtonRef = useRef(null);
    const menuRef = useRef(null);

    // Default files that cannot be renamed/deleted
    const defaultFiles = ['index.html', 'style.css', 'script.js'];

    useEffect(() => {
        setFiles(prev => ({
            ...prev,
            'index.html': code.html || '',
            'style.css': code.css || '',
            'script.js': code.js || '',
            ...(code.additionalFiles || {})
        }));
    }, [code.html, code.css, code.js, code.additionalFiles]);

    const restrictionsRef = useRef(restrictions);
    useEffect(() => {
        restrictionsRef.current = restrictions;
    }, [restrictions]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showAddMenu &&
                addButtonRef.current && !addButtonRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)) {
                setShowAddMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAddMenu]);

    // Get file extension and language
    const getFileInfo = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const info = {
            html: { language: 'html', icon: Code, color: 'text-orange-500' },
            css: { language: 'css', icon: Palette, color: 'text-blue-500' },
            js: { language: 'javascript', icon: FileText, color: 'text-yellow-500' },
            txt: { language: 'plaintext', icon: File, color: 'text-gray-500' },
        };
        return info[ext] || info.txt;
    };

    // Handle editor content change
    const handleEditorChange = (value) => {
        if (readOnly) return;
        const newFiles = { ...files, [activeFile]: value || '' };
        setFiles(newFiles);
        onChange(filesToCode(newFiles));
    };

    // Toggle add menu and calculate position
    const toggleAddMenu = () => {
        if (!showAddMenu && addButtonRef.current) {
            const rect = addButtonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 4,
                left: rect.left
            });
        }
        setShowAddMenu(!showAddMenu);
    };

    // Add new file
    const handleAddFile = (type) => {
        const extensions = { html: 'html', css: 'css', js: 'js', txt: 'txt' };
        const ext = extensions[type];
        let newName = `new.${ext}`;
        let counter = 1;

        while (files.hasOwnProperty(newName)) {
            newName = `new${counter}.${ext}`;
            counter++;
        }

        const newFiles = { ...files, [newName]: '' };
        setFiles(newFiles);
        setActiveFile(newName);
        setShowAddMenu(false);
        onChange(filesToCode(newFiles));

        setTimeout(() => {
            setRenamingFile(newName);
            setRenameValue(newName);
        }, 100);
    };

    // Start renaming
    const startRename = (filename, e) => {
        e.stopPropagation();
        if (defaultFiles.includes(filename)) return;
        setRenamingFile(filename);
        setRenameValue(filename);
        setTimeout(() => renameInputRef.current?.focus(), 50);
    };

    // Confirm rename
    const confirmRename = () => {
        if (!renameValue.trim() || renameValue === renamingFile) {
            setRenamingFile(null);
            return;
        }

        const ext = renameValue.split('.').pop().toLowerCase();
        if (!['html', 'css', 'js', 'txt'].includes(ext)) {
            alert('Allowed extensions: .html, .css, .js, .txt');
            return;
        }

        if (files.hasOwnProperty(renameValue)) {
            alert('File already exists');
            return;
        }

        const newFiles = { ...files };
        newFiles[renameValue] = newFiles[renamingFile];
        delete newFiles[renamingFile];

        setFiles(newFiles);
        if (activeFile === renamingFile) {
            setActiveFile(renameValue);
        }
        onChange(filesToCode(newFiles));
        setRenamingFile(null);
    };

    // Delete file
    const handleDeleteFile = (filename, e) => {
        e.stopPropagation();
        if (defaultFiles.includes(filename)) return;
        if (!confirm(`Delete "${filename}"?`)) return;

        const newFiles = { ...files };
        delete newFiles[filename];
        setFiles(newFiles);

        if (activeFile === filename) {
            setActiveFile(Object.keys(newFiles)[0]);
        }
        onChange(filesToCode(newFiles));
    };

    const fileList = Object.keys(files);
    const activeFileInfo = getFileInfo(activeFile);

    // Portal dropdown menu
    const dropdownMenu = showAddMenu && createPortal(
        <div
            ref={menuRef}
            className="fixed bg-[#313244] rounded-lg shadow-2xl py-1 min-w-[160px] border border-[#45475a]"
            style={{
                top: menuPosition.top,
                left: menuPosition.left,
                zIndex: 99999
            }}
        >
            <button
                onClick={() => handleAddFile('html')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-[#45475a] hover:text-white transition-colors"
            >
                <Code size={16} className="text-orange-500" /> New HTML file
            </button>
            <button
                onClick={() => handleAddFile('css')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-[#45475a] hover:text-white transition-colors"
            >
                <Palette size={16} className="text-blue-500" /> New CSS file
            </button>
            <button
                onClick={() => handleAddFile('js')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-[#45475a] hover:text-white transition-colors"
            >
                <FileText size={16} className="text-yellow-500" /> New JS file
            </button>
            <button
                onClick={() => handleAddFile('txt')}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-[#45475a] hover:text-white transition-colors"
            >
                <File size={16} className="text-gray-500" /> New TXT file
            </button>
        </div>,
        document.body
    );

    return (
        <div className="flex flex-col h-full bg-[#1e1e2e] rounded-md border border-[#313244] overflow-hidden">
            {/* File Tab Bar */}
            <div className="relative flex items-center bg-[#181825] border-b border-[#313244]">
                <div className="flex items-center overflow-x-auto flex-1">
                    {fileList.map((filename) => {
                        const info = getFileInfo(filename);
                        const Icon = info.icon;
                        const isActive = activeFile === filename;
                        const isDefault = defaultFiles.includes(filename);

                        return (
                            <div
                                key={filename}
                                onClick={() => !renamingFile && setActiveFile(filename)}
                                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-[#313244] transition-all
                ${isActive
                                        ? 'bg-[#1e1e2e] text-white border-t-2 border-t-indigo-500'
                                        : 'text-gray-400 hover:bg-[#1e1e2e]/50 hover:text-white'
                                    }`}
                            >
                                <Icon size={14} className={info.color} />

                                {renamingFile === filename ? (
                                    <input
                                        ref={renameInputRef}
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={confirmRename}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmRename();
                                            if (e.key === 'Escape') setRenamingFile(null);
                                        }}
                                        className="bg-[#313244] text-white text-xs px-2 py-0.5 rounded w-24 outline-none"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="text-xs font-medium whitespace-nowrap">{filename}</span>
                                )}

                                {!isDefault && !readOnly && !renamingFile && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => startRename(filename, e)}
                                            className="p-0.5 hover:bg-[#313244] rounded"
                                            title="Rename"
                                        >
                                            <Edit3 size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteFile(filename, e)}
                                            className="p-0.5 hover:bg-red-500/20 hover:text-red-400 rounded"
                                            title="Delete"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {!readOnly && (
                    <button
                        ref={addButtonRef}
                        onClick={toggleAddMenu}
                        className={`flex items-center justify-center w-8 h-8 mx-1 text-gray-400 hover:text-white hover:bg-[#313244] rounded transition-all ${showAddMenu ? 'bg-[#313244] text-white' : ''}`}
                        title="Add file"
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            {/* Portal dropdown */}
            {dropdownMenu}

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    language={activeFileInfo.language}
                    value={files[activeFile] || ''}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2, 
                        readOnly: readOnly,
                        domReadOnly: readOnly,
                        padding: { top: 12 },
                        autoClosingTags: true, // Enable HTML tag auto-closing
                        autoClosingBrackets: 'always', // Enable bracket auto-closing
                        autoClosingQuotes: 'always', // Enable quote auto-closing
                        autoSurround: 'languageDefined',
                        formatOnPaste: true,
                        contextmenu: false, // Anti-cheating: Disable editor context menu
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: 'on',
                        tabCompletion: 'on',
                        wordBasedSuggestions: true,
                    }}
                    onMount={(editor, monaco) => {
                        // Ensure HTML language service is configured
                        monaco.languages.html.htmlDefaults.setOptions({
                            format: {
                                tabSize: 2,
                                insertSpaces: true,
                                wrapLineLength: 120
                            },
                            suggest: {
                                html5: true
                            }
                        });
                        // Method 1: DOM Event Interception (Container)
                        const container = editor.getContainerDomNode();
                        container.addEventListener('paste', (e) => {
                            if (restrictionsRef.current?.blockPaste) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }, true);
                        container.addEventListener('copy', (e) => {
                            if (restrictionsRef.current?.blockCopy) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }, true);

                        // Method 2: KeyDown Interceptor (The most robust for shortcuts)
                        // Monaco's own keybinding system might sometimes fire before DOM, so we intercept here too.
                        editor.onKeyDown((e) => {
                            // Check for Ctrl/Cmd + V
                            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
                                if (restrictionsRef.current?.blockPaste) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }
                            // Check for Ctrl/Cmd + C or X
                            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.code === 'KeyX')) {
                                if (restrictionsRef.current?.blockCopy) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }
                        });


                        // Method 4: Editor-level Validations (Fallback)
                        // If content changes drastically in one go, it might be a paste.
                        // But we can't easily distinguish fast typing from pasting without the event.
                    }}
                />
            </div>
        </div>
    );
};

export default memo(MultiFileEditor);
