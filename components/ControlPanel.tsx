import React, { useState, useRef } from 'react';
import { GameStatus } from '../types';
import { generateBotScript } from '../services/geminiService';
import { DocsCard } from './DocsCard';

interface ControlPanelProps {
  status: GameStatus;
  currentCode: string;
  onPlay: () => void;
  onStop: () => void;
  onReset: () => void;
  onLoadScript: (code: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  status, 
  currentCode,
  onPlay, 
  onStop, 
  onReset,
  onLoadScript 
}) => {
  // AI State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // File State
  const [scriptName, setScriptName] = useState('KillerBot_v1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const script = await generateBotScript(prompt);
      onLoadScript(script);
    } catch (e) {
      alert('Failed to generate script.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveFile = () => {
    const name = scriptName.trim() || 'untitled_bot';
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.nbb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onLoadScript(event.target.result);
        // Update name to match file (strip extension)
        setScriptName(file.name.replace(/\.nbb$/i, '').replace(/\.txt$/i, ''));
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar pb-4">
      
      {/* 1. Game Controls */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
         
         {(status === GameStatus.STOPPED || status === GameStatus.GAME_OVER) && (
            <button onClick={onPlay} className="col-span-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded shadow-lg transition border-b-4 border-green-800 active:border-0 active:translate-y-1 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              RUN SIMULATION
            </button>
         )}

        {(status === GameStatus.RUNNING || status === GameStatus.PAUSED) && (
           <button onClick={onStop} className="col-span-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded shadow-lg transition border-b-4 border-red-800 active:border-0 active:translate-y-1 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
              STOP SIMULATION
           </button>
        )}

        {(status === GameStatus.STOPPED || status === GameStatus.GAME_OVER) && (
           <button onClick={onReset} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded shadow-lg transition border-b-4 border-slate-800 active:border-0 active:translate-y-1 text-sm flex items-center justify-center gap-2">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             RESET
           </button>
        )}
      </div>

      {/* 2. Data Port (File I/O) */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg shrink-0 relative overflow-hidden">
        {/* Decorative lines */}
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-600/50"></div>
        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full -translate-y-10 translate-x-10 blur-xl"></div>

        <div className="flex items-center justify-between text-purple-400 mb-3 pl-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <span className="font-display font-bold text-xs tracking-wider">DATA CARTRIDGE</span>
          </div>
          <span className="text-[9px] text-purple-500/50 font-mono border border-purple-500/30 px-1 rounded">IO-PORT-2</span>
        </div>

        <div className="pl-2">
           <div className="flex gap-2 mb-3">
              <input 
                type="text" 
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
                placeholder="Bot Name..." 
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
              />
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 text-[10px] text-slate-500 select-none">
                .NBB
              </div>
           </div>

           <div className="grid grid-cols-2 gap-2">
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileChange} 
               className="hidden" 
               accept=".nbb,.txt"
             />
             
             <button 
               onClick={handleLoadClick}
               className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-2 rounded border border-slate-600 hover:border-slate-500 transition flex items-center justify-center gap-2"
             >
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
               IMPORT
             </button>

             <button 
               onClick={handleSaveFile}
               className="bg-purple-700 hover:bg-purple-600 text-white text-[10px] font-bold py-2 rounded border border-purple-800 hover:border-purple-500 shadow-lg shadow-purple-900/20 transition flex items-center justify-center gap-2"
             >
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               EXPORT
             </button>
           </div>
        </div>
      </div>

      {/* 3. AI Assistant Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg shrink-0">
        <div className="flex items-center gap-2 text-cyan-400 mb-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="font-display font-bold text-xs tracking-wider">GEMINI CO-PILOT</span>
        </div>
        
        <div className="space-y-3">
          <textarea 
            className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-200 h-20 resize-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition placeholder-slate-600"
            placeholder="e.g., Create a bot that zig-zags and shoots when radar detects an enemy within 200 units."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className={`w-full py-2 rounded font-bold text-xs transition flex justify-center items-center gap-2 border-b-4 active:border-0 active:translate-y-1 ${
              isGenerating 
                ? 'bg-slate-700 border-slate-900 text-slate-500 cursor-not-allowed' 
                : 'bg-cyan-700 border-cyan-900 hover:bg-cyan-600 text-white'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                CODING...
              </>
            ) : (
              <>
                <span>GENERATE STRATEGY</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Documentation Card */}
      <DocsCard />

      <div className="text-[10px] text-slate-600 text-center font-mono pt-2">
        SYSTEM READY • V1.3
      </div>
    </div>
  );
};