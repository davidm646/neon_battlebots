
import React, { useEffect, useRef } from 'react';
import { RobotState, Projectile, Explosion, GameConfig, GameStatus, LaserBeam, Missile } from '../types';
import { ARENA_WIDTH, ARENA_HEIGHT, ROBOT_RADIUS, SCAN_RANGE, WEAPON_MISSILE } from '../constants';

interface ArenaProps {
  bots: RobotState[];
  projectiles: (Projectile | Missile)[];
  explosions: Explosion[];
  lasers?: LaserBeam[];
  config: GameConfig;
  status: GameStatus;
  onBotClick?: (botId: string) => void;
}

export const Arena: React.FC<ArenaProps> = ({ bots, projectiles, explosions, lasers = [], config, status, onBotClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle Click for Selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onBotClick || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check collision with any bot
    // We iterate backwards to click "top" bots first if they overlap
    for (let i = bots.length - 1; i >= 0; i--) {
      const bot = bots[i];
      const dx = clickX - bot.x;
      const dy = clickY - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= ROBOT_RADIUS * 1.5) { // Generous hit area
        onBotClick(bot.id);
        return;
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render Loop (Visuals only, state is passed in props which updates on game tick)
    const draw = () => {
      // Clear background
      ctx.fillStyle = '#0f172a'; // Slate-900
      ctx.fillRect(0, 0, config.width, config.height);

      // Draw Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for(let x=0; x<=config.width; x+=50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, config.height); ctx.stroke();
      }
      for(let y=0; y<=config.height; y+=50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(config.width, y); ctx.stroke();
      }

      // Draw Line of Sight (PAUSED MODE ONLY)
      if (status === GameStatus.PAUSED || status === GameStatus.STOPPED) {
        bots.forEach(bot => {
          if (bot.health <= 0) return;
          
          ctx.save();
          ctx.translate(bot.x, bot.y);
          ctx.rotate((bot.turretAngle * Math.PI) / 180);

          // Laser Sight (Center line) only - Cone removed as requested
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(SCAN_RANGE, 0);
          ctx.strokeStyle = bot.id === 'player' ? 'rgba(6, 182, 212, 0.5)' : 'rgba(239, 68, 68, 0.5)';
          ctx.setLineDash([10, 10]);
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();
        });
      }

      // Draw Lasers (Before bots so they appear under them if starting from center, but physics starts at gun tip)
      lasers.forEach(l => {
        let startX = l.x1;
        let startY = l.y1;
        
        // If the laser belongs to a bot, attach the start point to the bot's current turret position
        if (l.ownerId) {
          const owner = bots.find(b => b.id === l.ownerId);
          // Ensure bot is alive and valid before moving the laser origin
          if (owner && owner.health > 0) {
             const turretRad = (owner.turretAngle * Math.PI) / 180;
             startX = owner.x + Math.cos(turretRad) * 25;
             startY = owner.y + Math.sin(turretRad) * 25;
          }
        }

        ctx.save();
        ctx.globalAlpha = l.life; // Fade out
        ctx.strokeStyle = l.color;
        
        // Inner Beam
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        
        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = l.color;
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.restore();
      });

      // Draw Bots
      bots.forEach(bot => {
        if (bot.health <= 0) return; // Dead bots don't render or render as wreckage

        // --- TARGET LOCK RETICLE ---
        // If this bot is targeted by another bot's active lock, draw a reticle
        // Only draw if the attacker is using Missiles AND HAS AMMO
        bots.forEach(other => {
           if (
             other.targetLockId === bot.id && 
             other.health > 0 && 
             other.activeWeapon === WEAPON_MISSILE &&
             (other.ammo[WEAPON_MISSILE] || 0) > 0
            ) {
              ctx.save();
              ctx.translate(bot.x, bot.y);
              ctx.strokeStyle = '#f43f5e'; // Rose color
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              // Rotating Reticle
              const angle = (Date.now() / 1000) % (Math.PI * 2);
              ctx.rotate(angle);
              ctx.strokeRect(-ROBOT_RADIUS - 5, -ROBOT_RADIUS - 5, (ROBOT_RADIUS + 5)*2, (ROBOT_RADIUS + 5)*2);
              ctx.restore();
           }
        });

        // --- SCANNER PULSE EFFECT ---
        const currentTime = bot.registers.get('TIME') || 0;
        const timeSinceScan = currentTime - bot.lastScanTime;
        const FADE_FRAMES = 15; // Duration of scan pulse
        
        if (timeSinceScan >= 0 && timeSinceScan < FADE_FRAMES) {
           const opacity = 1 - (timeSinceScan / FADE_FRAMES);
           ctx.save();
           ctx.translate(bot.x, bot.y);
           ctx.rotate((bot.lastScanAngle * Math.PI) / 180);
           
           ctx.fillStyle = bot.color; // Use bot color for scan
           ctx.globalAlpha = opacity * 0.2; // Fainter opacity
           
           // Draw a wide wedge/sector for the "Ping" effect
           // Barely protruding from the bot
           const PULSE_RADIUS = ROBOT_RADIUS * 2; 
           const PULSE_WIDTH = 10; // Degrees +/- (20 degrees total)

           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.arc(0, 0, PULSE_RADIUS, -PULSE_WIDTH * Math.PI / 180, PULSE_WIDTH * Math.PI / 180);
           ctx.lineTo(0, 0);
           ctx.fill();
           
           // Draw an edge line
           ctx.globalAlpha = opacity * 0.4; // Fainter edge
           ctx.strokeStyle = bot.color;
           ctx.lineWidth = 1;
           ctx.beginPath();
           ctx.arc(0, 0, PULSE_RADIUS, -PULSE_WIDTH * Math.PI / 180, PULSE_WIDTH * Math.PI / 180);
           ctx.stroke();

           ctx.restore();
        }

        // --- RENDER BOT ---
        ctx.save();
        ctx.translate(bot.x, bot.y);
        
        // Bars Container (Unrotated)
        // Health Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(-20, -45, 40, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-20, -45, 40 * (bot.health / 100), 4);

        // Heat Bar
        ctx.fillStyle = '#334155'; // Bg
        ctx.fillRect(-20, -40, 40, 3);
        // Color shift from yellow to red based on heat
        ctx.fillStyle = bot.overheated ? '#ef4444' : '#f59e0b';
        ctx.fillRect(-20, -40, 40 * (bot.heat / 100), 3);

        // Overheat Indicator
        if (bot.overheated) {
           ctx.font = 'bold 10px monospace';
           ctx.fillStyle = '#ef4444';
           ctx.textAlign = 'center';
           ctx.fillText('JAMMED!', 0, -50);
        }

        // --- Bot Body (Neon Style) ---
        ctx.rotate((bot.angle * Math.PI) / 180);
        
        // Glow Effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = bot.color;

        // Chassis (Stroke only for neon look)
        ctx.fillStyle = '#0f172a'; // Dark fill to cover grid lines
        ctx.strokeStyle = bot.color;
        ctx.lineWidth = 2;
        
        const r = ROBOT_RADIUS - 2;
        ctx.beginPath();
        ctx.roundRect(-r, -r, r * 2, r * 2, 4);
        ctx.fill();
        ctx.stroke();

        // Direction Indicator (Arrow inside chassis)
        // Points towards positive X (Right)
        ctx.fillStyle = bot.color;
        ctx.beginPath();
        ctx.moveTo(r - 6, 0); // Tip
        ctx.lineTo(-4, -8);   // Top back
        ctx.lineTo(0, 0);     // Center notch
        ctx.lineTo(-4, 8);    // Bottom back
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();

        // --- Turret (Independent rotation) ---
        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate((bot.turretAngle * Math.PI) / 180);
        
        ctx.shadowBlur = 5;
        ctx.shadowColor = bot.overheated ? '#ef4444' : bot.color;
        
        // Simple Gun Barrel
        ctx.strokeStyle = bot.overheated ? '#ef4444' : '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(26, 0);
        ctx.stroke();
        
        // Small Pivot Point
        ctx.fillStyle = bot.color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // Draw Projectiles & Missiles
      projectiles.forEach(p => {
        const isMissile = (p as Missile).targetId !== undefined;

        ctx.save();
        ctx.translate(p.x, p.y);
        
        if (isMissile) {
          const m = p as Missile;
          ctx.rotate((m.angle * Math.PI) / 180);
          ctx.fillStyle = '#f43f5e'; // Rose/Pink missile
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#f43f5e';
          
          // Triangle shape
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-4, -4);
          ctx.lineTo(-4, 4);
          ctx.closePath();
          ctx.fill();
          
          // Thruster glow
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(-4, 0, 2, 0, Math.PI*2);
          ctx.fill();
        } else {
          // Standard Projectile
          ctx.fillStyle = '#fbbf24';
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'orange';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Explosions
      explosions.forEach(exp => {
        ctx.save();
        ctx.globalAlpha = exp.life;
        ctx.fillStyle = exp.color;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });
    };

    requestAnimationFrame(draw);
  }, [bots, projectiles, explosions, lasers, config, status]);

  return (
    <canvas 
      ref={canvasRef} 
      width={config.width} 
      height={config.height}
      onClick={handleCanvasClick}
      className={`rounded-lg border-2 border-slate-700 shadow-2xl bg-slate-950 ${status !== GameStatus.RUNNING ? 'cursor-pointer' : 'cursor-default'}`}
    />
  );
};
