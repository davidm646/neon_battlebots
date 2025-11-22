
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Arena } from './components/Arena';
import { CodeEditor } from './components/CodeEditor';
import { ControlPanel } from './components/ControlPanel';
import { DebuggerPanel } from './components/DebuggerPanel';
import { GameStatus, RobotState, Projectile, Explosion, BotConfig } from './types';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOT_SCRIPT, TARGET_BOT_SCRIPT, ROBOT_RADIUS, PROJECTILE_SPEED, PROJECTILE_RADIUS, DAMAGE_PER_SHOT, HEAT_PER_SHOT, HEAT_DECAY, MAX_HEAT, BOT_PALETTE } from './constants';
import { VM } from './services/vm';
import { Compiler } from './services/compiler';

// Inject Compiler into window for VM access (simple pattern for this scope)
(window as any).Compiler = Compiler;

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

  const getRandomColor = () => BOT_PALETTE[Math.floor(Math.random() * BOT_PALETTE.length)];

  const createNewBot = (name: string, code: string = DEFAULT_BOT_SCRIPT): BotConfig => ({
    id: crypto.randomUUID(),
    name,
    code,
    color: getRandomColor()
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

  // --- Game Initialization ---

  const initGame = useCallback(() => {
    const startBots: RobotState[] = [];
    
    // Spawn bots from Roster
    roster.forEach((config, index) => {
      // Simple random spawn logic with margin
      const margin = 100;
      let x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      let y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      
      // Create VM Instance
      startBots.push(VM.createRobot(config.id, config.color, config.code, x, y));
    });

    setBots(startBots);
    setProjectiles([]);
    setExplosions([]);
    
    botsRef.current = startBots;
    projectilesRef.current = [];
    explosionsRef.current = [];
  }, [roster]);

  // --- Roster Sync Effect ---
  // Keeps the visual battlefield in sync with the roster when editing/adding/removing
  // while the simulation is STOPPED.
  useEffect(() => {
    if (status !== GameStatus.STOPPED) return;

    // Identify changes
    const rosterIds = new Set(roster.map(b => b.id));
    const currentBotIds = new Set(bots.map(b => b.id));

    // Check if structure changed (add/remove) or if we just need to update code
    const structureChanged = roster.length !== bots.length || !roster.every(r => currentBotIds.has(r.id));

    if (structureChanged) {
      // If bots were added or removed, we have to re-init to spawn them correctly
      // (or delete them). Re-init is safest to ensure valid placement for new bots.
      initGame();
    } else {
      // "Soft Update": Only code or name changed.
      // Update the VM state in place without resetting position/health.
      const updatedBots = bots.map(bot => {
         const config = roster.find(r => r.id === bot.id);
         if (!config) return bot;

         // Re-create VM state to parse new code, but preserve physics state
         const newVmState = VM.createRobot(config.id, config.color, config.code, bot.x, bot.y);
         
         return {
           ...newVmState,
           x: bot.x,
           y: bot.y,
           angle: bot.angle,
           turretAngle: bot.turretAngle,
           // In STOPPED state, we generally want to reset variables/registers when code changes,
           // so using newVmState's memory is correct.
         };
      });

      setBots(updatedBots);
      botsRef.current = updatedBots;
    }
  }, [roster, status, initGame, bots]);


  // --- Physics Loop ---

  const updatePhysicsAndLogic = useCallback((cycles = 5) => {
    const currentBots = [...botsRef.current];
    let currentProjs = [...projectilesRef.current];
    let currentExplosions = [...explosionsRef.current];

    // 1. Run VM and Physics for Bots
    currentBots.forEach(bot => {
      if (bot.health <= 0) return;

      // Heat Decay
      if (bot.heat > 0) {
        bot.heat = Math.max(0, bot.heat - HEAT_DECAY);
      }
      
      // Recover from Overheat
      if (bot.overheated && bot.heat <= 0) {
        bot.overheated = false;
      }

      // Execute VM
      VM.step(bot, currentBots, cycles);

      // Physics Movement
      const rad = (bot.angle * Math.PI) / 180;
      bot.x += Math.cos(rad) * (bot.speed / 2); // Scale speed down slightly
      bot.y += Math.sin(rad) * (bot.speed / 2);

      // Wall Collisions
      bot.x = Math.max(ROBOT_RADIUS, Math.min(ARENA_WIDTH - ROBOT_RADIUS, bot.x));
      bot.y = Math.max(ROBOT_RADIUS, Math.min(ARENA_HEIGHT - ROBOT_RADIUS, bot.y));

      // Firing Logic
      if (bot.registers.get('SHOOT') === 1) {
         if (!bot.overheated) {
             const pRad = (bot.turretAngle * Math.PI) / 180;
             currentProjs.push({
               id: Math.random().toString(),
               ownerId: bot.id,
               x: bot.x + Math.cos(pRad) * 25,
               y: bot.y + Math.sin(pRad) * 25,
               vx: Math.cos(pRad) * PROJECTILE_SPEED,
               vy: Math.sin(pRad) * PROJECTILE_SPEED,
               damage: DAMAGE_PER_SHOT,
               active: true
             });

             bot.heat += HEAT_PER_SHOT;
             if (bot.heat >= MAX_HEAT) {
               bot.heat = MAX_HEAT;
               bot.overheated = true;
             }
         }
      }
      bot.registers.set('SHOOT', 0);
    });

    // 2. Physics for Projectiles
    currentProjs.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > ARENA_WIDTH || p.y < 0 || p.y > ARENA_HEIGHT) {
        p.active = false;
      }

      currentBots.forEach(bot => {
        if (!p.active || bot.health <= 0 || bot.id === p.ownerId) return;
        
        const dx = p.x - bot.x;
        const dy = p.y - bot.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < ROBOT_RADIUS + PROJECTILE_RADIUS) {
          p.active = false;
          bot.health -= p.damage;
          
          currentExplosions.push({
            id: Math.random().toString(),
            x: p.x, y: p.y, radius: 5, maxRadius: 20, life: 1, color: '#f59e0b'
          });
        }
      });
    });

    currentProjs = currentProjs.filter(p => p.active);

    // 3. Update Explosions
    currentExplosions.forEach(e => {
      e.life -= 0.05;
      e.radius += 2;
    });
    currentExplosions = currentExplosions.filter(e => e.life > 0);

    botsRef.current = currentBots;
    projectilesRef.current = currentProjs;
    explosionsRef.current = currentExplosions;

    setBots(currentBots);
    setProjectiles(currentProjs);
    setExplosions(currentExplosions);
  }, []);

  // --- Game Loop ---

  const gameLoop = useCallback(() => {
    if (status !== GameStatus.RUNNING) return;
    updatePhysicsAndLogic(5);
    
    // Victory Condition: 0 or 1 bot remaining
    const aliveCount = botsRef.current.filter(b => b.health > 0).length;
    // Only trigger game over if we started with more than 1 bot
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
        initGame();
    }
    setStatus(GameStatus.RUNNING);
  };

  const handleReset = () => {
    setStatus(GameStatus.STOPPED);
    initGame();
  };

  // --- Derived State ---
  const selectedBotConfig = roster.find(b => b.id === selectedBotId);
  const selectedBotRuntime = bots.find(b => b.id === selectedBotId); // For debugger

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
