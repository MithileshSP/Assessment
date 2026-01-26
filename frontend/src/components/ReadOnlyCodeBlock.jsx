import Editor from '@monaco-editor/react';

const ReadOnlyCodeBlock = ({ code, language, height = "250px" }) => {
    return (
        <div className="relative group" style={{ height: height === '100%' ? '100%' : 'auto' }}>
            <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-xl group-hover:bg-blue-500/10 transition-all" />
            <div className="relative bg-[#0f172a] rounded-[2rem] overflow-hidden shadow-2xl border border-white/5" style={{ height, minHeight: height === '100%' ? '600px' : 'auto' }}>
                <Editor
                    height="100%"
                    language={language === 'js' ? 'javascript' : language}
                    value={code || ''}
                    theme="vs-dark"
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        domReadOnly: true,
                        renderLineHighlight: 'none',
                        selectionHighlight: false,
                        occurrencesHighlight: false,
                        folding: true,
                        scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible',
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                        },
                    }}
                />
            </div>
        </div>
    );
};

export default ReadOnlyCodeBlock;
