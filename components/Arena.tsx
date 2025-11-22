
import React, { useEffect, useRef } from 'react';
import { RobotState, Projectile, Explosion, GameConfig, GameStatus, LaserBeam, Missile } from '../types';
import { ROBOT_RADIUS, SCAN_RANGE, WEAPON_MISSILE } from '../constants';

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

    for (let i = bots.length - 1; i >= 0; i--) {
      const bot = bots[i];
      const dx = clickX - bot.x;
      const dy = clickY - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= ROBOT_RADIUS * 1.5) { 
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

    // Render Loop
    const draw = () => {
      // Clear background
      ctx.fillStyle = '#0f172a'; // Slate-900
      ctx.fillRect(0, 0, config.width, config.height);

      // Draw Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      // Draw up to 100 lines in each direction to handle huge maps without performance kill
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

          // Laser Sight
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

      // Draw Lasers
      lasers.forEach(l => {
        let startX = l.x1;
        let startY = l.y1;
        
        if (l.ownerId) {
          const owner = bots.find(b => b.id === l.ownerId);
          if (owner && owner.health > 0) {
             const turretRad = (owner.turretAngle * Math.PI) / 180;
             startX = owner.x + Math.cos(turretRad) * 25;
             startY = owner.y + Math.sin(turretRad) * 25;
          }
        }

        ctx.save();
        ctx.globalAlpha = l.life; 
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        ctx.shadowBlur = 15; ctx.shadowColor = l.color; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
      });

      // Draw Bots
      bots.forEach(bot => {
        if (bot.health <= 0) return;

        // Target Lock Reticle
        bots.forEach(other => {
           if (
             other.targetLockId === bot.id && 
             other.health > 0 && 
             other.activeWeapon === WEAPON_MISSILE &&
             (other.ammo[WEAPON_MISSILE] || 0) > 0
            ) {
              ctx.save();
              ctx.translate(bot.x, bot.y);
              ctx.strokeStyle = '#f43f5e'; 
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              const angle = (Date.now() / 1000) % (Math.PI * 2);
              ctx.rotate(angle);
              ctx.strokeRect(-ROBOT_RADIUS - 5, -ROBOT_RADIUS - 5, (ROBOT_RADIUS + 5)*2, (ROBOT_RADIUS + 5)*2);
              ctx.restore();
           }
        });

        // Scan Pulse
        const currentTime = bot.registers.get('TIME') || 0;
        const timeSinceScan = currentTime - bot.lastScanTime;
        const FADE_FRAMES = 15; 
        
        if (timeSinceScan >= 0 && timeSinceScan < FADE_FRAMES) {
           const opacity = 1 - (timeSinceScan / FADE_FRAMES);
           ctx.save();
           ctx.translate(bot.x, bot.y);
           ctx.rotate((bot.lastScanAngle * Math.PI) / 180);
           ctx.fillStyle = bot.color;
           ctx.globalAlpha = opacity * 0.2;
           const PULSE_RADIUS = ROBOT_RADIUS * 2; 
           const PULSE_WIDTH = 10;
           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.arc(0, 0, PULSE_RADIUS, -PULSE_WIDTH * Math.PI / 180, PULSE_WIDTH * Math.PI / 180);
           ctx.lineTo(0, 0);
           ctx.fill();
           ctx.globalAlpha = opacity * 0.4;
           ctx.strokeStyle = bot.color;
           ctx.lineWidth = 1;
           ctx.beginPath();
           ctx.arc(0, 0, PULSE_RADIUS, -PULSE_WIDTH * Math.PI / 180, PULSE_WIDTH * Math.PI / 180);
           ctx.stroke();
           ctx.restore();
        }

        // Render Bot
        ctx.save();
        ctx.translate(bot.x, bot.y);
        
        // Bars
        ctx.fillStyle = 'red'; ctx.fillRect(-20, -45, 40, 4);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(-20, -45, 40 * (bot.health / 100), 4);
        ctx.fillStyle = '#334155'; ctx.fillRect(-20, -40, 40, 3);
        ctx.fillStyle = bot.overheated ? '#ef4444' : '#f59e0b'; ctx.fillRect(-20, -40, 40 * (bot.heat / 100), 3);

        if (bot.overheated) {
           ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center'; ctx.fillText('JAMMED!', 0, -50);
        }

        // Chassis
        ctx.rotate((bot.angle * Math.PI) / 180);
        ctx.shadowBlur = 10; ctx.shadowColor = bot.color;
        ctx.fillStyle = '#0f172a'; ctx.strokeStyle = bot.color; ctx.lineWidth = 2;
        const r = ROBOT_RADIUS - 2;
        ctx.beginPath(); ctx.roundRect(-r, -r, r * 2, r * 2, 4); ctx.fill(); ctx.stroke();

        // Arrow
        ctx.fillStyle = bot.color;
        ctx.beginPath(); ctx.moveTo(r - 6, 0); ctx.lineTo(-4, -8); ctx.lineTo(0, 0); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill();
        ctx.restore();

        // Turret
        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate((bot.turretAngle * Math.PI) / 180);
        ctx.shadowBlur = 5; ctx.shadowColor = bot.overheated ? '#ef4444' : bot.color;
        ctx.strokeStyle = bot.overheated ? '#ef4444' : '#e2e8f0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.stroke();
        ctx.fillStyle = bot.color; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Draw Projectiles
      projectiles.forEach(p => {
        const isMissile = (p as Missile).targetId !== undefined;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (isMissile) {
          const m = p as Missile;
          ctx.rotate((m.angle * Math.PI) / 180);
          ctx.fillStyle = '#f43f5e'; ctx.shadowBlur = 10; ctx.shadowColor = '#f43f5e';
          ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-4, 0, 2, 0, Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle = '#fbbf24'; ctx.shadowBlur = 10; ctx.shadowColor = 'orange';
          ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      });

      // Draw Explosions
      explosions.forEach(exp => {
        ctx.save();
        ctx.globalAlpha = exp.life; ctx.fillStyle = exp.color;
        ctx.beginPath(); ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI*2); ctx.fill();
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
      // Use CSS to force the canvas to fit the container, maintaining aspect ratio
      style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: `${config.width}/${config.height}` }}
      className={`rounded-lg border-2 border-slate-700 shadow-2xl bg-slate-950 ${status !== GameStatus.RUNNING ? 'cursor-pointer' : 'cursor-default'}`}
    />
  );
};
