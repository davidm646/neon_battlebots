
import React, { useState, useRef } from 'react';
import { GameStatus, BotConfig } from '../types';
import { generateBotScript } from '../services/geminiService';
import { DocsCard } from './DocsCard';
import { DEFAULT_BOT_SCRIPT, TARGET_BOT_SCRIPT } from '../constants';

interface ControlPanelProps {
  status: GameStatus;
  roster: BotConfig[];
  selectedBotId: string | null;
  onAddBot: (name: string, code?: string) => void;
  onRemoveBot: (id: string) => void;
  onSelectBot: (id: string) => void;
  onUpdateBotCode: (id: string, code: string) => void;
  onPlay: () => void;
  onStop: () => void;
  onReset: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  status, 
  roster,
  selectedBotId,
  onAddBot,
  onRemoveBot,
  onSelectBot,
  onUpdateBotCode,
  onPlay, 
  onStop, 
  onReset,
}) => {
  // AI State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // File State
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedBotId) return;
    setIsGenerating(true);
    try {
      const script = await generateBotScript(prompt);
      onUpdateBotCode(selectedBotId, script);
    } catch (e) {
      alert('Failed to generate script.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveFile = () => {
    const bot = roster.find(b => b.id === selectedBotId);
    if (!bot) return;
    
    const blob = new Blob([bot.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bot.name}.nbb`;
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
        const name = file.name.replace(/\.nbb$/i, '').replace(/\.txt$/i, '');
        onAddBot(name, event.target.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden pb-1">
      
      {/* Scrollable Upper Section */}
      <div className="shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
        
        {/* 1. Game Controls */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
           {(status === GameStatus.STOPPED || status === GameStatus.GAME_OVER) && (
              <button 
                onClick={onPlay} 
                disabled={roster.length === 0}
                className={`col-span-1 font-bold py-3 px-4 rounded shadow-lg transition border-b-4 active:border-0 active:translate-y-1 flex items-center justify-center gap-2 ${roster.length === 0 ? 'bg-slate-700 border-slate-900 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 border-green-800 text-white'}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                BATTLE
              </button>
           )}

          {(status === GameStatus.RUNNING || status === GameStatus.PAUSED) && (
             <button onClick={onStop} className="col-span-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded shadow-lg transition border-b-4 border-red-800 active:border-0 active:translate-y-1 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                ABORT
             </button>
          )}

          {(status === GameStatus.STOPPED || status === GameStatus.GAME_OVER) && (
             <button onClick={onReset} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded shadow-lg transition border-b-4 border-slate-800 active:border-0 active:translate-y-1 text-sm flex items-center justify-center gap-2">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               RESET
             </button>
          )}
        </div>

        {/* 2. Battle Roster */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg shrink-0 flex flex-col gap-3">
           <div className="flex items-center justify-between text-slate-300">
             <div className="font-display font-bold text-xs tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                BATTLE ROSTER ({roster.length})
             </div>
           </div>

           <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar bg-slate-900/50 p-2 rounded">
              {roster.length === 0 && (
                <div className="text-[10px] text-slate-500 text-center italic py-2">No active bots</div>
              )}
              {roster.map(bot => (
                <div 
                  key={bot.id} 
                  onClick={() => onSelectBot(bot.id)}
                  className={`flex items-center justify-between p-2 rounded border cursor-pointer transition ${selectedBotId === bot.id ? 'bg-slate-700 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                >
                   <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-3 h-3 rounded-full shadow" style={{ backgroundColor: bot.color }}></div>
                      <span className="text-xs font-mono font-bold text-slate-200 truncate">{bot.name}</span>
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); onRemoveBot(bot.id); }}
                     className="text-slate-500 hover:text-red-400"
                   >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>
              ))}
           </div>

           <div className="grid grid-cols-2 gap-2">
              <button 
                 onClick={() => onAddBot(`Bot_${roster.length + 1}`, DEFAULT_BOT_SCRIPT)}
                 className="bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-bold py-2 rounded border border-cyan-800 hover:border-cyan-500 transition flex items-center justify-center gap-1"
              >
                 + NEW BOT
              </button>
              <button 
                 onClick={() => onAddBot('Target Dummy', TARGET_BOT_SCRIPT)}
                 className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold py-2 rounded border border-slate-600 transition"
              >
                 + TARGET
              </button>
           </div>
           
           <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
               <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".nbb,.txt" />
               <button 
                 onClick={handleLoadClick}
                 className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-2 rounded border border-slate-600 transition flex items-center justify-center gap-1"
               >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                 LOAD ROBOT
               </button>
               <button 
                 onClick={handleSaveFile}
                 disabled={!selectedBotId}
                 className={`text-slate-200 text-[10px] font-bold py-2 rounded border transition flex items-center justify-center gap-1 ${!selectedBotId ? 'bg-slate-800 border-slate-800 text-slate-600' : 'bg-purple-700 hover:bg-purple-600 border-purple-800 hover:border-purple-500'}`}
               >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 SAVE ROBOT
               </button>
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
              disabled={!selectedBotId}
              className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-200 h-20 resize-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={selectedBotId ? "Describe strategy to generate code..." : "Select a bot to use AI"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt || !selectedBotId}
              className={`w-full py-2 rounded font-bold text-xs transition flex justify-center items-center gap-2 border-b-4 active:border-0 active:translate-y-1 ${
                isGenerating || !selectedBotId
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
      </div>

      {/* 4. Documentation Card - Now Flexes to fill space */}
      <DocsCard />

      <div className="text-[10px] text-slate-600 text-center font-mono shrink-0">
        SYSTEM READY • V1.5
      </div>
    </div>
  );
};
