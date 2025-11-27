import React, { useRef, useEffect } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';

declare global {
  interface Window {
    monaco: any;
  }
}

export interface EditorFile {
  name: string;
  language: string;
  content: string;
}

interface EditorProps {
  files: EditorFile[];
  activeFileName: string;
  onFileChange: (fileName: string) => void;
  onCodeChange: (fileName: string, newCode: string) => void;
  readOnly?: boolean;
}

export const Editor: React.FC<EditorProps> = ({ 
  files, 
  activeFileName, 
  onFileChange, 
  onCodeChange, 
  readOnly = false 
}) => {
  const activeFile = files.find(f => f.name === activeFileName) || files[0];
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorChange = (value: string | undefined) => {
    onCodeChange(activeFile.name, value || '');
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Trigger initial decoration update
    updateDecorations(editor, monaco, activeFile.content);

    // Listen for changes to update decorations dynamically
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model) {
        updateDecorations(editor, monaco, model.getValue());
      }
    });
  };

  // Function to scan for "____" and apply "prompt modal" decorations
  const updateDecorations = (editor: any, monaco: any, code: string) => {
    if (!code) return;

    const matches: any[] = [];
    const regex = /____/g;
    let match;

    // Find all occurrences of the placeholder
    while ((match = regex.exec(code)) !== null) {
      const startPos = editor.getModel()?.getPositionAt(match.index);
      const endPos = editor.getModel()?.getPositionAt(match.index + match[0].length);
      
      if (startPos && endPos) {
        matches.push({
          range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          options: {
            isWholeLine: false,
            inlineClassName: 'blank-highlight', // Highlights the underscores
            afterContentClassName: 'blank-badge', // Adds the "Fill here" badge/modal
            hoverMessage: { value: '**Action Required**: Replace `____` with the correct code.' }
          }
        });
      }
    }

    // Apply the decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, matches);
  };

  // Re-run decorations when switching files or active file changes
  useEffect(() => {
    if (editorRef.current && window.monaco) {
      updateDecorations(editorRef.current, window.monaco, activeFile.content);
    }
  }, [activeFileName, activeFile.content]);

  // Helper for language color indicators
  const getLanguageColor = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'java': return 'bg-orange-500';
      case 'python': return 'bg-blue-500';
      case 'javascript': return 'bg-yellow-400';
      case 'typescript': return 'bg-blue-600';
      case 'html': return 'bg-red-500';
      case 'css': return 'bg-indigo-400';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-slate-700 bg-[#1e1e1e] shadow-2xl flex flex-col flex-1 h-full min-h-0">
      {/* Tab Bar */}
      <div className="flex items-center bg-[#1e1e1e] border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
        {files.map((file) => (
          <button
            key={file.name}
            onClick={() => onFileChange(file.name)}
            className={`
              group flex items-center px-4 py-2.5 text-[13px] font-medium border-r border-slate-800 transition-all min-w-[120px] select-none
              ${file.name === activeFileName 
                ? 'bg-[#1e1e1e] text-white border-t-2 border-t-orange-500' 
                : 'bg-[#2d2d2d] text-slate-400 hover:bg-[#252526] hover:text-slate-200 border-t-2 border-t-transparent'}
            `}
          >
            <span className={`w-2 h-2 rounded-full mr-2 ${getLanguageColor(file.language)}`}></span>
            {file.name}
          </button>
        ))}
      </div>
      
      {/* Editor Area */}
      {/* min-h-0 is crucial for flex child scrolling to work correctly */}
      <div className="flex-1 relative min-h-0 bg-[#1e1e1e]">
        <MonacoEditor
          height="100%"
          path={activeFile.name} // Key for model maintenance
          defaultLanguage={activeFile.language}
          language={activeFile.language}
          value={activeFile.content}
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: false }, // Remove minimap for cleaner view
            
            // Typography (VS Code Defaults)
            fontSize: 14,
            lineHeight: 22,
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            fontLigatures: true,
            
            // Indentation (Java Standard)
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: false,
            
            // Layout & Scrolling
            scrollBeyondLastLine: false, // Prevents scrolling into empty space
            wordWrap: 'on', // Enforce wrapping to fit window
            wrappingStrategy: 'advanced', // Better wrapping logic
            wrappingIndent: 'indent',
            automaticLayout: true,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'hidden', // Hide horizontal scrollbar since we wrap
              useShadows: false,
              verticalScrollbarSize: 10,
            },
            
            // Visuals
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            renderLineHighlight: 'line', // 'line' is cleaner than 'all'
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
            renderWhitespace: 'selection',
            
            // Formatting
            formatOnPaste: true,
            formatOnType: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm bg-[#1e1e1e]">
               Loading Editor...
            </div>
          }
        />
        
        {readOnly && (
           <div className="absolute top-2 right-4 pointer-events-none opacity-50 z-10">
             <span className="text-[10px] uppercase tracking-widest text-slate-500 border border-slate-700 px-2 py-1 rounded bg-[#1e1e1e]">Read Only</span>
           </div>
        )}
      </div>
    </div>
  );
};