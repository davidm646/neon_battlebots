
import React, { useRef, useEffect } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  botName: string;
  readOnly?: boolean;
  error?: string | null;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, botName, readOnly, error }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono flex justify-between items-center shrink-0">
        <span>PROGRAM MEMORY</span>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded uppercase font-bold ${readOnly ? 'bg-slate-700 text-slate-400' : 'bg-green-900 text-green-300'}`}>
            {botName}
          </span>
        </div>
      </div>
      
      {readOnly && !code ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-xs p-4 text-center">
          SELECT OR CREATE A BOT<br/>TO EDIT PROGRAM
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 group flex flex-col">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 w-full h-full bg-transparent text-green-400 p-4 font-mono text-sm outline-none resize-none whitespace-pre custom-scrollbar"
              style={{ lineHeight: '24px' }}
              spellCheck={false}
              placeholder="; Enter bot assembly code here..."
              wrap="off" 
            />
            
            {/* Compilation Error Banner */}
            {error && (
              <div className="bg-red-900/90 text-red-200 text-xs font-mono p-2 border-t border-red-700 flex items-center gap-2 shrink-0 animate-slideUp">
                 <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <span>COMPILATION ERROR: {error}</span>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
