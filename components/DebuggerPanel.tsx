import React from 'react';
import { RobotState, GameStatus } from '../types';

interface DebuggerPanelProps {
  bot?: RobotState;
  gameStatus: GameStatus;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
}

const SYSTEM_REGISTERS = new Set([
  'SPEED', 'ANGLE', 'TURRET', 'SHOOT', 'RADAR', 'X', 'Y', 'HEALTH', 'TIME', 'HEAT'
]);

// Helper to categorize registers
const categorizeRegisters = (registers: Map<string, number>) => {
  const sys: { key: string, val: number }[] = [];
  const usr: { key: string, val: number }[] = [];

  registers.forEach((val, key) => {
    if (SYSTEM_REGISTERS.has(key)) {
      sys.push({ key, val });
    } else {
      usr.push({ key, val });
    }
  });

  // Sort alphabetically
  sys.sort((a, b) => a.key.localeCompare(b.key));
  usr.sort((a, b) => a.key.localeCompare(b.key));

  return { sys, usr };
};

export const DebuggerPanel: React.FC<DebuggerPanelProps> = ({ 
  bot, 
  gameStatus, 
  onRun,
  onPause, 
  onResume, 
  onStep,
  onReset
}) => {
  const isPaused = gameStatus === GameStatus.PAUSED;
  const isRunning = gameStatus === GameStatus.RUNNING;
  const isStopped = gameStatus === GameStatus.STOPPED;
  const isActive = isPaused || isRunning;

  if (!bot) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 h-full flex items-center justify-center text-slate-600 text-xs font-mono">
        OFFLINE - START SIMULATION TO DEBUG
      </div>
    );
  }

  // No useMemo here to ensure we get fresh values every render (60fps)
  const { sys, usr } = categorizeRegisters(bot.registers);
  const currentInstr = bot.program[bot.pc];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg flex flex-col h-full shrink-0 shadow-lg">
      {/* Header & Controls */}
      <div className="bg-slate-800/80 px-3 py-2 border-b border-slate-700 flex justify-between items-center shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
            CPU DEBUGGER
          </span>
          <span className="text-[10px] font-mono text-cyan-500 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50">
            PC: {String(bot.pc).padStart(3, '0')}
          </span>
        </div>

        <div className="flex gap-2">
           {/* Stopped State Controls */}
           {isStopped && (
            <>
               <button 
                onClick={onRun}
                className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-green-800 active:border-0 active:translate-y-px transition flex items-center gap-1"
              >
                RUN
              </button>
            </>
           )}

          {/* Running State Controls */}
          {isRunning && (
            <button 
              onClick={onPause}
              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-amber-800 active:border-0 active:translate-y-px transition"
            >
              PAUSE
            </button>
          )}

          {/* Paused State Controls */}
          {isPaused && (
            <>
              <button 
                onClick={onResume}
                className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-green-800 active:border-0 active:translate-y-px transition"
              >
                RESUME
              </button>
              <button 
                onClick={onStep}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-indigo-800 active:border-0 active:translate-y-px transition flex items-center gap-1"
              >
                STEP <span className="opacity-50">→</span>
              </button>
            </>
          )}

           {/* Always available Reset if not running, or if running/paused */}
           {!isStopped && (
              <button 
                onClick={onReset}
                className="bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-slate-800 active:border-0 active:translate-y-px transition"
              >
                RESET
              </button>
           )}
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left: Execution Log */}
        <div className="w-1/2 border-r border-slate-800 p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar bg-slate-950/30">
          <div className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Instruction Stream</div>
          
          {/* Current Instruction */}
          <div className="flex gap-2 items-stretch group">
             <div className="w-1 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
             <div className="flex-1 bg-slate-800 p-2 rounded border border-slate-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-cyan-900/50 text-cyan-300 text-[8px] px-1 rounded-bl">LINE {currentInstr?.originalLine || '?'}</div>
               {currentInstr ? (
                 <div className="font-mono text-xs mt-1">
                   <span className="text-pink-400 font-bold mr-2">{currentInstr.op}</span>
                   <span className="text-purple-300">{currentInstr.args.join(' ')}</span>
                 </div>
               ) : (
                 <span className="text-slate-500 text-xs italic">END OF PROGRAM</span>
               )}
             </div>
          </div>

          {/* Context Info */}
          <div className="mt-auto bg-slate-900/50 p-2 rounded border border-slate-800/50 text-[10px] font-mono text-slate-400">
             <div>FLAGS: <span className={bot.cmpFlag === 0 ? 'text-white' : ''}>EQ</span> • <span className={bot.cmpFlag > 0 ? 'text-white' : ''}>GT</span> • <span className={bot.cmpFlag < 0 ? 'text-white' : ''}>LT</span></div>
             <div className="mt-1">HEAT: {bot.heat}/100 {bot.overheated ? <span className="text-red-500 font-bold">JAMMED</span> : ''}</div>
          </div>
        </div>

        {/* Right: Memory View */}
        <div className="w-1/2 flex flex-col bg-slate-900/50">
           
           {/* System Registers */}
           <div className="flex-1 p-2 overflow-y-auto custom-scrollbar border-b border-slate-800">
              <div className="text-[9px] font-bold text-slate-500 mb-1 uppercase sticky top-0 bg-slate-900/90 backdrop-blur py-1">System Registers</div>
              <div className="grid grid-cols-2 gap-1">
                {sys.map(({ key, val }) => (
                  <div key={key} className="flex justify-between items-center bg-slate-800 px-1.5 py-1 rounded border border-slate-700/50 hover:border-slate-500 transition-colors">
                    <span className="text-[9px] font-bold text-pink-400">{key}</span>
                    <span className={`text-[9px] font-mono ${key === 'HEAT' && val > 80 ? 'text-red-400 font-bold' : 'text-slate-200'}`}>{val}</span>
                  </div>
                ))}
              </div>
           </div>

           {/* User Variables */}
           <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-slate-950/20">
              <div className="text-[9px] font-bold text-slate-500 mb-1 uppercase sticky top-0 bg-slate-900/90 backdrop-blur py-1">Variables</div>
              {usr.length === 0 ? (
                <div className="text-[9px] text-slate-600 italic p-1">No variables detected</div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {usr.map(({ key, val }) => (
                    <div key={key} className="flex justify-between items-center bg-slate-800/50 px-1.5 py-1 rounded border border-slate-700/30 hover:bg-slate-800 transition-colors">
                      <span className="text-[9px] font-bold text-purple-400">{key}</span>
                      <span className="text-[9px] font-mono text-slate-300">{val}</span>
                    </div>
                  ))}
                </div>
              )}
           </div>

        </div>

      </div>
    </div>
  );
};