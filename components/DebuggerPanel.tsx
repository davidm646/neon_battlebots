
import React, { useRef, useEffect } from 'react';
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
  'SPEED', 'ANGLE', 'TURRET', 'AIM', 'SHOOT', 'RADAR', 'X', 'Y', 'HEALTH', 'TIME', 'HEAT', 'WEAPON', 'AMMO'
]);

// Helper to categorize registers
const categorizeRegisters = (registers: Map<string, number>) => {
  const sys: { key: string, val: number }[] = [];
  const user: { key: string, val: number }[] = [];
  
  registers.forEach((val, key) => {
    if (SYSTEM_REGISTERS.has(key)) {
      sys.push({ key, val });
    } else {
      user.push({ key, val });
    }
  });

  // Sort alphabetically
  sys.sort((a, b) => a.key.localeCompare(b.key));
  user.sort((a, b) => a.key.localeCompare(b.key));

  return { sys, user };
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

  // Refs for auto-scrolling the instruction list
  const activeInstrRef = useRef<HTMLDivElement>(null);
  const instrListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeInstrRef.current && instrListRef.current) {
      // Scroll to center the active instruction
      const container = instrListRef.current;
      const element = activeInstrRef.current;
      const top = element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
      container.scrollTo({ top, behavior: 'smooth' });
    }
  }, [bot?.pc, bot?.program, isRunning]);

  // Header is always visible
  const renderHeader = () => (
    <div className="bg-slate-800/80 px-3 py-2 border-b border-slate-700 flex justify-between items-center shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
            CPU DEBUGGER
          </span>
          {bot && (
            <span className="text-[10px] font-mono text-cyan-500 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50">
              PC: {String(bot.pc).padStart(3, '0')}
            </span>
          )}
        </div>

        <div className="flex gap-2">
           {isStopped && (
               <button 
                onClick={onRun}
                className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-green-800 active:border-0 active:translate-y-px transition flex items-center gap-1"
              >
                RUN
              </button>
           )}

          {isRunning && (
            <button 
              onClick={onPause}
              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded border-b-2 border-amber-800 active:border-0 active:translate-y-px transition"
            >
              PAUSE
            </button>
          )}

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
  );

  if (!bot) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg flex flex-col h-full shrink-0 shadow-lg">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-mono p-4 text-center">
          {isStopped ? "SELECT A BOT FROM ROSTER" : "SIMULATION NOT RUNNING"}
        </div>
      </div>
    );
  }

  const { sys, user } = categorizeRegisters(bot.registers);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg flex flex-col h-full shrink-0 shadow-lg">
      {renderHeader()}
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 p-3 bg-slate-900/50 overflow-hidden">
           
           {/* Main Split View: Side by Side */}
           <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
               
               {/* Left Column: Execution Stream */}
               <div className="flex flex-col bg-black rounded border border-slate-800 overflow-hidden shadow-inner h-full">
                  <div className="bg-slate-900/80 px-2 py-1 text-[9px] font-bold text-slate-500 border-b border-slate-800 uppercase tracking-wider shrink-0">
                     Execution Stream
                  </div>
                  {isRunning ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center opacity-50">
                       <svg className="w-8 h-8 text-slate-700 mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                       </svg>
                       <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                          Simulation Running
                       </div>
                       <div className="text-[9px] text-slate-700 mt-1">
                          PAUSE TO DEBUG CODE
                       </div>
                    </div>
                  ) : (
                    <div ref={instrListRef} className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5 font-mono text-xs relative">
                       {bot.program.map((instr, index) => {
                          const isCurrent = index === bot.pc;
                          return (
                             <div 
                               key={index}
                               ref={isCurrent ? activeInstrRef : null}
                               className={`flex gap-3 px-2 py-0.5 rounded ${isCurrent ? 'bg-yellow-900/40 text-yellow-200 border-l-2 border-yellow-500' : 'text-slate-600'}`}
                             >
                                <div className="w-6 text-right opacity-50 select-none">{String(index).padStart(3, '0')}</div>
                                <div className="flex-1 whitespace-pre truncate">
                                   <span className={isCurrent ? 'font-bold text-yellow-400' : 'text-cyan-700 font-bold'}>{instr.op}</span>
                                   <span className="ml-2 text-slate-400">{instr.args.join(' ')}</span>
                                </div>
                             </div>
                          );
                       })}
                       {bot.program.length === 0 && <div className="text-slate-600 text-center py-2">Empty Program</div>}
                    </div>
                  )}
               </div>

               {/* Right Column: Registers (System + User) */}
               <div className="flex flex-col h-full min-h-0 bg-slate-950/30 rounded border border-slate-800/50">
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    
                    {/* System Registers */}
                    <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-wider border-b border-slate-800 pb-1 flex justify-between">
                        <span>System</span>
                        <span className="text-slate-600">R/W</span>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 mb-4">
                      {sys.map(({ key, val }) => (
                        <div key={key} className="flex flex-col justify-center bg-slate-800 px-2 py-1.5 rounded border border-slate-700/50 hover:border-slate-500 transition-colors">
                          <span className="text-[9px] font-bold text-pink-400 mb-0.5">{key}</span>
                          <span className={`text-xs font-mono font-bold ${key === 'HEAT' && val > 80 ? 'text-red-400' : 'text-slate-200'}`}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* User Variables */}
                    <div className="text-[9px] font-bold text-slate-500 mb-2 uppercase tracking-wider border-b border-slate-800 pb-1 mt-4">
                        User Variables
                    </div>
                    {user.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                          {user.map(({ key, val }) => (
                            <div key={key} className="flex flex-col justify-center bg-slate-800 px-2 py-1.5 rounded border border-slate-700/50 hover:border-slate-500 transition-colors">
                               <span className="text-[9px] font-bold text-purple-400 mb-0.5">{key}</span>
                               <span className="text-xs font-mono font-bold text-slate-200">{val}</span>
                            </div>
                          ))}
                        </div>
                    ) : (
                        <div className="text-[9px] text-slate-700 italic text-center py-2">No user variables defined</div>
                    )}
                  </div>
               </div>
           </div>
      </div>
    </div>
  );
};
