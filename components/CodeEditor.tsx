import React, { useRef, useEffect, useState } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  botName: string;
  readOnly?: boolean;
  error?: string | null;
  onAiAssist?: (instruction: string) => Promise<void>;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, botName, readOnly, error, onAiAssist }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !onAiAssist) return;
    
    setIsAiLoading(true);
    try {
      await onAiAssist(prompt);
      setPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

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
            
            {/* AI Assistant Bar */}
            {!readOnly && onAiAssist && (
              <form onSubmit={handleAiSubmit} className="bg-slate-950 p-2 border-t border-slate-800 flex items-center gap-2 shrink-0">
                  <div className="text-cyan-500 shrink-0">
                    {isAiLoading ? (
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={isAiLoading ? "Updating code..." : "Tell Gemini how to adjust this code..."}
                    disabled={isAiLoading}
                    className="flex-1 bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-600 font-mono focus:text-cyan-100 transition-colors"
                  />
                  <button 
                    type="submit" 
                    disabled={!prompt.trim() || isAiLoading}
                    className="text-slate-500 hover:text-cyan-400 disabled:opacity-30 transition"
                    title="Apply Changes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
              </form>
            )}
            
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