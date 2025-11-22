import React from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange }) => {
  return (
    <div className="relative h-full w-full flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono flex justify-between items-center">
        <span>PROGRAM MEMORY</span>
        <span className="bg-green-900 text-green-300 px-2 py-0.5 rounded">ASM-BOT-V1</span>
      </div>
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full bg-[#0d1117] text-green-400 p-4 font-mono text-sm outline-none resize-none leading-6"
        spellCheck={false}
        placeholder="; Enter bot assembly code here..."
      />
    </div>
  );
};