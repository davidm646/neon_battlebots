
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Arena } from './components/Arena';
import { CodeEditor } from './components/CodeEditor';
import { ControlPanel } from './components/ControlPanel';
import { DebuggerPanel } from './components/DebuggerPanel';
import { GameStatus, RobotState, Projectile, Explosion, BotConfig } from './types';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOT_SCRIPT, TARGET_BOT_SCRIPT, ROBOT_RADIUS, PROJECTILE_SPEED, PROJECTILE_RADIUS, DAMAGE_PER_SHOT, HEAT_PER_SHOT, HEAT_DECAY, MAX_HEAT, BOT_PALETTE, TURRET_SPEED, COLLISION_DAMAGE_FACTOR, WALL_DAMAGE_FACTOR, COLLISION_BOUNCE } from './constants';
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
    const currentBots = [...botsRef.current];
    let currentProjs = [...projectilesRef.current];
    let currentExplosions = [...explosionsRef.current];

    // 1. Run VM and Logic
    currentBots.forEach(bot => {
      if (bot.health <= 0) return;

      // Heat Decay
      if (bot.heat > 0) {
        bot.heat = Math.max(0, bot.heat - HEAT_DECAY);
      }
      if (bot.overheated && bot.heat <= 0) {
        bot.overheated = false;
      }

      // Execute VM
      VM.step(bot, currentBots, cycles);

      // Move Bot based on registers
      const rad = (bot.angle * Math.PI) / 180;
      bot.x += Math.cos(rad) * (bot.speed / 2); 
      bot.y += Math.sin(rad) * (bot.speed / 2);

      // Turret Rotation Smoothing
      let diff = bot.desiredTurretAngle - bot.turretAngle;
      while (diff <= -180) diff += 360;
      while (diff > 180) diff -= 360;

      if (Math.abs(diff) < TURRET_SPEED) {
        bot.turretAngle = bot.desiredTurretAngle;
      } else {
        bot.turretAngle += Math.sign(diff) * TURRET_SPEED;
      }
      bot.turretAngle = (bot.turretAngle + 360) % 360;

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

    // 2. Collision Resolution (Walls & Bots)
    currentBots.forEach((bot, i) => {
       if (bot.health <= 0) return;
       
       // --- WALL COLLISIONS ---
       let hitWall = false;
       
       // Left Wall
       if (bot.x < ROBOT_RADIUS) {
         bot.x = ROBOT_RADIUS;
         hitWall = true;
       } 
       // Right Wall
       else if (bot.x > ARENA_WIDTH - ROBOT_RADIUS) {
         bot.x = ARENA_WIDTH - ROBOT_RADIUS;
         hitWall = true;
       }

       // Top Wall
       if (bot.y < ROBOT_RADIUS) {
         bot.y = ROBOT_RADIUS;
         hitWall = true;
       }
       // Bottom Wall
       else if (bot.y > ARENA_HEIGHT - ROBOT_RADIUS) {
         bot.y = ARENA_HEIGHT - ROBOT_RADIUS;
         hitWall = true;
       }

       if (hitWall && bot.speed > 0) {
         // Damage based on speed
         bot.health -= bot.speed * WALL_DAMAGE_FACTOR;
         // Crash stop/bounce
         bot.speed = Math.floor(bot.speed * COLLISION_BOUNCE);
         bot.registers.set('SPEED', bot.speed); // Update register to reflect physics change
       }


       // --- BOT VS BOT COLLISIONS ---
       for (let j = i + 1; j < currentBots.length; j++) {
         const other = currentBots[j];
         if (other.health <= 0) continue;

         const dx = other.x - bot.x;
         const dy = other.y - bot.y;
         const dist = Math.sqrt(dx*dx + dy*dy);
         const minDist = ROBOT_RADIUS * 2;

         if (dist < minDist) {
           // Overlap detected!
           const angle = Math.atan2(dy, dx);
           const overlap = minDist - dist;
           
           // 1. Separate them (push apart equally)
           const moveX = (Math.cos(angle) * overlap) / 2;
           const moveY = (Math.sin(angle) * overlap) / 2;
           
           bot.x -= moveX;
           bot.y -= moveY;
           other.x += moveX;
           other.y += moveY;

           // 2. Apply Damage based on combined speed (Impact)
           const impact = (bot.speed + other.speed) * COLLISION_DAMAGE_FACTOR;
           // Minimum impact damage of 2 just for touching
           const damage = Math.max(2, impact); 
           
           bot.health -= damage;
           other.health -= damage;

           // 3. Visuals (Explosion at midpoint)
           const midX = bot.x + (dx / 2);
           const midY = bot.y + (dy / 2);
           currentExplosions.push({
              id: Math.random().toString(),
              x: midX, y: midY, radius: 10, maxRadius: 25, life: 1, color: '#cbd5e1' // White/Smoke sparks
           });

           // 4. Slow down both bots (Crash physics)
           bot.speed = Math.floor(bot.speed * COLLISION_BOUNCE);
           other.speed = Math.floor(other.speed * COLLISION_BOUNCE);
           
           bot.registers.set('SPEED', bot.speed);
           other.registers.set('SPEED', other.speed);
         }
       }
    });


    // 3. Physics for Projectiles
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

    // 4. Update Explosions
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
