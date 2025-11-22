
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Arena } from './components/Arena';
import { CodeEditor } from './components/CodeEditor';
import { ControlPanel } from './components/ControlPanel';
import { DebuggerPanel } from './components/DebuggerPanel';
import { GameStatus, RobotState, Projectile, Explosion, BotConfig } from './types';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOT_SCRIPT, TARGET_BOT_SCRIPT, BOT_PALETTE } from './constants';
import { VM } from './services/vm';
import { PhysicsEngine } from './services/physics';

export default function App() {
  // --- Roster State (The Source of Truth for Bots) ---
  const [roster, setRoster] = useState<BotConfig[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  // --- Game Simulation State ---
  const [status, setStatus] = useState<GameStatus>(GameStatus.STOPPED);
  const [bots, setBots] = useState<RobotState[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);

  // Refs for Loop Speed
  const botsRef = useRef<RobotState[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const requestRef = useRef<number>(0);

  // --- UI Resizing State ---
  const [editorHeightPercent, setEditorHeightPercent] = useState(60);
  const colRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // --- Helper Functions ---

  const getUniqueColor = () => {
    const usedColors = new Set(roster.map(b => b.color));
    const available = BOT_PALETTE.filter(c => !usedColors.has(c));
    
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    
    // Fallback: Random bright neon color if palette is exhausted
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 80%, 60%)`;
  };

  const createNewBot = (name: string, code: string = DEFAULT_BOT_SCRIPT): BotConfig => ({
    id: crypto.randomUUID(),
    name,
    code,
    color: getUniqueColor()
  });

  const updateBotCode = (id: string, newCode: string) => {
    setRoster(prev => prev.map(b => b.id === id ? { ...b, code: newCode } : b));
  };

  const updateBotName = (id: string, newName: string) => {
    setRoster(prev => prev.map(b => b.id === id ? { ...b, name: newName } : b));
  };

  const addBotToRoster = (bot: BotConfig) => {
    setRoster(prev => [...prev, bot]);
    setSelectedBotId(bot.id); // Auto select new bot
  };

  const removeBotFromRoster = (id: string) => {
    setRoster(prev => prev.filter(b => b.id !== id));
    if (selectedBotId === id) {
      setSelectedBotId(null);
    }
  };

  // --- Game State Management ---

  // Full Reset: Randomizes positions (Used for Reset Button)
  const scrambleAndReset = useCallback(() => {
    const startBots: RobotState[] = [];
    
    roster.forEach((config) => {
      const margin = 100;
      let x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      let y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      
      startBots.push(VM.createRobot(config.id, config.color, config.code, x, y));
    });

    setBots(startBots);
    setProjectiles([]);
    setExplosions([]);
    botsRef.current = startBots;
    projectilesRef.current = [];
    explosionsRef.current = [];
  }, [roster]);

  // Restart Match: Keeps positions, resets Health/VM (Used for Play Button)
  const restartMatch = useCallback(() => {
    // Re-create bot state (health 100, fresh VM) but PRESERVE position/angle
    const freshBots = botsRef.current.map(bot => {
      const config = roster.find(r => r.id === bot.id);
      if (!config) return bot; // Should not happen if synced

      const newState = VM.createRobot(config.id, config.color, config.code, bot.x, bot.y);
      // Keep their current angle so they don't snap to 0
      newState.angle = bot.angle;
      newState.turretAngle = bot.turretAngle;
      newState.desiredTurretAngle = bot.turretAngle;
      return newState;
    });

    // If roster has bots that aren't in botsRef (e.g. cleared array), spawn them
    if (freshBots.length < roster.length) {
       const existingIds = new Set(freshBots.map(b => b.id));
       roster.forEach(config => {
         if (!existingIds.has(config.id)) {
            const margin = 100;
            const x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
            const y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
            freshBots.push(VM.createRobot(config.id, config.color, config.code, x, y));
         }
       });
    }

    setBots(freshBots);
    setProjectiles([]);
    setExplosions([]);
    botsRef.current = freshBots;
    projectilesRef.current = [];
    explosionsRef.current = [];
  }, [roster]);

  // --- Roster Sync Effect ---
  useEffect(() => {
    if (status !== GameStatus.STOPPED) return;

    setBots(currentBots => {
       const nextBots = roster.map(config => {
          const existing = currentBots.find(b => b.id === config.id);
          
          if (existing) {
            // Update VM (in case code changed) but Keep Position
            const vmBot = VM.createRobot(config.id, config.color, config.code, existing.x, existing.y);
            return {
              ...vmBot,
              x: existing.x,
              y: existing.y,
              angle: existing.angle,
              turretAngle: existing.turretAngle,
              desiredTurretAngle: existing.turretAngle
            };
          } else {
            // New Bot: Random Position
            const margin = 100;
            const x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
            const y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
            return VM.createRobot(config.id, config.color, config.code, x, y);
          }
       });
       
       botsRef.current = nextBots;
       return nextBots;
    });

  }, [roster, status]);


  // --- Physics Loop ---

  const updatePhysicsAndLogic = useCallback((cycles = 5) => {
    const nextState = PhysicsEngine.update(
      botsRef.current,
      projectilesRef.current,
      explosionsRef.current,
      cycles
    );

    botsRef.current = nextState.bots;
    projectilesRef.current = nextState.projectiles;
    explosionsRef.current = nextState.explosions;

    setBots(nextState.bots);
    setProjectiles(nextState.projectiles);
    setExplosions(nextState.explosions);
  }, []);

  // --- Game Loop ---

  const gameLoop = useCallback(() => {
    if (status !== GameStatus.RUNNING) return;
    updatePhysicsAndLogic(5);
    
    const aliveCount = botsRef.current.filter(b => b.health > 0).length;
    if (roster.length > 1 && aliveCount <= 1) { 
        setStatus(GameStatus.GAME_OVER);
        return; 
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [status, updatePhysicsAndLogic, roster.length]);

  useEffect(() => {
    if (status === GameStatus.RUNNING) {
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, gameLoop]);

  // --- Handlers ---

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !colRef.current) return;
    const containerRect = colRef.current.getBoundingClientRect();
    const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    setEditorHeightPercent(Math.min(Math.max(newHeight, 20), 80));
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const handlePlay = () => {
    if (status === GameStatus.GAME_OVER || status === GameStatus.STOPPED) {
        restartMatch();
    }
    setStatus(GameStatus.RUNNING);
  };

  const handleReset = () => {
    setStatus(GameStatus.STOPPED);
    scrambleAndReset();
  };

  // --- Derived State ---
  const selectedBotConfig = roster.find(b => b.id === selectedBotId);
  const selectedBotRuntime = bots.find(b => b.id === selectedBotId);

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col p-4 gap-4 overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 rounded border border-slate-800 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center font-bold text-white font-display">N</div>
          <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">NEON BATTLEBOTS</h1>
        </div>
        <div className="text-xs font-mono text-slate-500 hidden sm:block">MULTI-BOT ARENA • REACT 18 • GEMINI AI</div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Editor & Debugger */}
        <div ref={colRef} className="lg:col-span-3 flex flex-col h-full min-h-0">
           <div style={{ height: `${editorHeightPercent}%` }} className="shrink-0 pb-1">
              <CodeEditor 
                code={selectedBotConfig ? selectedBotConfig.code : ''} 
                onChange={(code) => selectedBotId && updateBotCode(selectedBotId, code)} 
                botName={selectedBotConfig ? selectedBotConfig.name : 'NO BOT SELECTED'}
                readOnly={!selectedBotId}
              />
           </div>
           
           {/* Splitter */}
           <div 
             onMouseDown={startResizing}
             className="h-3 hover:bg-slate-800 cursor-row-resize flex items-center justify-center shrink-0 transition-colors group -mx-2 px-2 select-none z-10"
           >
             <div className="w-12 h-1 bg-slate-700 rounded-full group-hover:bg-cyan-500 transition-colors shadow-sm" />
           </div>

           <div className="flex-1 pt-1 min-h-0">
              <DebuggerPanel 
                bot={selectedBotRuntime} 
                gameStatus={status} 
                onRun={handlePlay}
                onPause={() => setStatus(GameStatus.PAUSED)}
                onResume={handlePlay} 
                onStep={() => updatePhysicsAndLogic(1)}
                onReset={handleReset}
              />
           </div>
        </div>

        {/* Middle: Arena */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800 relative overflow-hidden h-full min-h-0 shadow-inner">
          {/* Overlays */}
          {status === GameStatus.GAME_OVER && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
              <div className="text-center">
                 <div className="text-4xl font-display font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-2">SIMULATION ENDED</div>
                 <div className="text-cyan-400 font-mono">
                    {bots.filter(b => b.health > 0).length === 1 
                       ? `WINNER: ${roster.find(r => r.id === bots.find(b => b.health > 0)?.id)?.name.toUpperCase()}` 
                       : 'DRAW / ANNIHILATION'}
                 </div>
              </div>
            </div>
          )}

          {status === GameStatus.PAUSED && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-[2px]">
               <div className="bg-amber-600/90 text-white font-display font-bold text-2xl px-8 py-3 rounded border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] tracking-widest animate-pulse">
                 PAUSED
               </div>
            </div>
          )}

          {roster.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center z-0">
                <div className="text-slate-600 font-mono text-sm">ROSTER EMPTY. ADD BOTS TO BEGIN.</div>
             </div>
          )}

          <Arena 
            bots={bots} 
            projectiles={projectiles} 
            explosions={explosions} 
            config={{width: ARENA_WIDTH, height: ARENA_HEIGHT, fps: 60}} 
            status={status}
            onBotClick={setSelectedBotId}
          />
        </div>

        {/* Right: Controls & Roster */}
        <div className="lg:col-span-3 h-full min-h-0">
          <ControlPanel 
            status={status} 
            roster={roster}
            selectedBotId={selectedBotId}
            onAddBot={(name, code) => addBotToRoster(createNewBot(name, code))}
            onRemoveBot={removeBotFromRoster}
            onSelectBot={setSelectedBotId}
            onUpdateBotCode={updateBotCode}
            onPlay={handlePlay} 
            onStop={() => setStatus(GameStatus.STOPPED)} 
            onReset={handleReset}
          />
        </div>
      </main>
    </div>
  );
}
