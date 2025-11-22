
import React from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  botName: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, botName, readOnly }) => {
  return (
    <div className="relative h-full w-full flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono flex justify-between items-center shrink-0">
        <span>PROGRAM MEMORY</span>
        <span className={`px-2 py-0.5 rounded uppercase font-bold ${readOnly ? 'bg-slate-700 text-slate-400' : 'bg-green-900 text-green-300'}`}>
          {botName}
        </span>
      </div>
      
      {readOnly ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-xs p-4 text-center">
          SELECT OR CREATE A BOT<br/>TO EDIT PROGRAM
        </div>
      ) : (
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 w-full bg-[#0d1117] text-green-400 p-4 font-mono text-sm outline-none resize-none leading-6"
          spellCheck={false}
          placeholder="; Enter bot assembly code here..."
        />
      )}
    </div>
  );
};
