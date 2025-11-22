import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Arena } from './components/Arena';
import { CodeEditor } from './components/CodeEditor';
import { ControlPanel } from './components/ControlPanel';
import { DebuggerPanel } from './components/DebuggerPanel';
import { GameStatus, RobotState, Projectile, Explosion } from './types';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOT_SCRIPT, TARGET_BOT_SCRIPT, ROBOT_RADIUS, PROJECTILE_SPEED, PROJECTILE_RADIUS, DAMAGE_PER_SHOT } from './constants';
import { VM } from './services/vm';
import { Compiler } from './services/compiler';

// Inject Compiler into window for VM access (simple pattern for this scope)
(window as any).Compiler = Compiler;

export default function App() {
  // User Code
  const [userCode, setUserCode] = useState(DEFAULT_BOT_SCRIPT);
  
  // Game State
  const [status, setStatus] = useState<GameStatus>(GameStatus.STOPPED);
  const [bots, setBots] = useState<RobotState[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);

  // Refs for loop speed access
  const botsRef = useRef<RobotState[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const requestRef = useRef<number>(0);

  // Resizing Logic
  const [editorHeightPercent, setEditorHeightPercent] = useState(60);
  const colRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

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
    // Clamp between 20% and 80%
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

  const initGame = useCallback(() => {
    const playerBot = VM.createRobot('player', '#06b6d4', userCode, 100, 300);
    const enemyBot = VM.createRobot('enemy', '#ef4444', TARGET_BOT_SCRIPT, 700, 300);
    const newBots = [playerBot, enemyBot];
    
    setBots(newBots);
    setProjectiles([]);
    setExplosions([]);
    botsRef.current = newBots;
    projectilesRef.current = [];
    explosionsRef.current = [];
  }, [userCode]);

  // Initialize on mount
  useEffect(() => {
    initGame();
  }, [initGame]);

  const updatePhysicsAndLogic = useCallback((cycles = 5) => {
    const currentBots = [...botsRef.current];
    let currentProjs = [...projectilesRef.current];
    let currentExplosions = [...explosionsRef.current];

    // 1. Run VM and Physics for Bots
    currentBots.forEach(bot => {
      if (bot.health <= 0) return;

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
         // Add projectile
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
      }

      // CRITICAL: Reset SHOOT register to 0 after processing.
      // This ensures proper single-shot behavior per frame (or per step).
      bot.registers.set('SHOOT', 0);
    });

    // 2. Physics for Projectiles
    currentProjs.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Boundary check
      if (p.x < 0 || p.x > ARENA_WIDTH || p.y < 0 || p.y > ARENA_HEIGHT) {
        p.active = false;
      }

      // Bot Collision
      currentBots.forEach(bot => {
        if (!p.active || bot.health <= 0 || bot.id === p.ownerId) return;
        
        const dx = p.x - bot.x;
        const dy = p.y - bot.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < ROBOT_RADIUS + PROJECTILE_RADIUS) {
          p.active = false;
          bot.health -= p.damage;
          
          // Explosion effect
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

    // 4. Update Refs and State
    botsRef.current = currentBots;
    projectilesRef.current = currentProjs;
    explosionsRef.current = currentExplosions;

    // Force re-render for visuals
    setBots(currentBots);
    setProjectiles(currentProjs);
    setExplosions(currentExplosions);
  }, []);

  const gameLoop = useCallback(() => {
    if (status !== GameStatus.RUNNING) return;
    updatePhysicsAndLogic(5); // Normal speed: 5 instructions per frame
    
    // Check Victory Condition
    const aliveCount = botsRef.current.filter(b => b.health > 0).length;
    if (aliveCount < 2) { // Assuming 2 bots, if < 2 alive, someone won (or draw)
        setStatus(GameStatus.GAME_OVER);
        return; // Stop loop
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [status, updatePhysicsAndLogic]);

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

  const handlePlay = () => {
    // If playing from Game Over, reset first
    if (status === GameStatus.GAME_OVER || status === GameStatus.STOPPED) {
        initGame();
    }
    setStatus(GameStatus.RUNNING);
  };

  const handlePause = () => {
    setStatus(GameStatus.PAUSED);
  };

  const handleStep = () => {
    // Execute 1 instruction only.
    updatePhysicsAndLogic(1); 
  };

  const handleStop = () => {
    setStatus(GameStatus.STOPPED);
  };

  const handleReset = () => {
    setStatus(GameStatus.STOPPED);
    initGame();
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col p-4 gap-4 overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 rounded border border-slate-800 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center font-bold text-white font-display">N</div>
          <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">NEON BATTLEBOTS</h1>
        </div>
        <div className="text-xs font-mono text-slate-500 hidden sm:block">REACT 18 • GEMINI AI • TYPESCRIPT</div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Editor & Debugger */}
        <div ref={colRef} className="lg:col-span-3 flex flex-col h-full min-h-0">
           <div style={{ height: `${editorHeightPercent}%` }} className="shrink-0 pb-1">
              <CodeEditor code={userCode} onChange={setUserCode} />
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
                bot={bots[0]} 
                gameStatus={status} 
                onRun={handlePlay}
                onPause={handlePause}
                onResume={handlePlay} 
                onStep={handleStep}
                onReset={handleReset}
              />
           </div>
        </div>

        {/* Middle: Arena */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800 relative overflow-hidden h-full min-h-0 shadow-inner">
          {/* Overlay for Win/Loss */}
          {bots[0]?.health <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-lg">
              <div className="text-4xl font-display font-bold text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">DEFEAT</div>
            </div>
          )}
           {bots[1]?.health <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-lg">
              <div className="text-4xl font-display font-bold text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">VICTORY</div>
            </div>
          )}

          <Arena 
            bots={bots} 
            projectiles={projectiles} 
            explosions={explosions} 
            config={{width: ARENA_WIDTH, height: ARENA_HEIGHT, fps: 60}} 
            status={status}
          />
          
          {/* Stats Overlay */}
          <div className="absolute bottom-4 left-4 flex gap-4">
            <div className="bg-slate-900/80 border border-slate-700 p-2 rounded text-xs font-mono shadow-lg">
              <div className="text-cyan-400 font-bold mb-1">PLAYER</div>
              <div>HP: {Math.max(0, Math.floor(bots[0]?.health || 0))}</div>
              <div>SPD: {bots[0]?.speed || 0}</div>
              <div>RADAR: {bots[0]?.lastScanResult}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 p-2 rounded text-xs font-mono shadow-lg">
              <div className="text-red-400 font-bold mb-1">TARGET</div>
              <div>HP: {Math.max(0, Math.floor(bots[1]?.health || 0))}</div>
            </div>
          </div>
        </div>

        {/* Right: Controls & Help */}
        <div className="lg:col-span-3 h-full min-h-0">
          <ControlPanel 
            status={status} 
            currentCode={userCode}
            onPlay={handlePlay} 
            onStop={handleStop} 
            onReset={handleReset}
            onLoadScript={setUserCode}
          />
        </div>
      </main>
    </div>
  );
}