import React, { useEffect, useRef } from 'react';
import { RobotState, Projectile, Explosion, GameConfig, GameStatus } from '../types';
import { ARENA_WIDTH, ARENA_HEIGHT, ROBOT_RADIUS, SCAN_RANGE } from '../constants';

interface ArenaProps {
  bots: RobotState[];
  projectiles: Projectile[];
  explosions: Explosion[];
  config: GameConfig;
  status: GameStatus;
}

export const Arena: React.FC<ArenaProps> = ({ bots, projectiles, explosions, config, status }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      if (status === GameStatus.PAUSED) {
        bots.forEach(bot => {
          if (bot.health <= 0) return;
          
          ctx.save();
          ctx.translate(bot.x, bot.y);
          ctx.rotate((bot.turretAngle * Math.PI) / 180);

          // Vision Cone (5 degrees total, +/- 2.5)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, SCAN_RANGE, -2.5 * Math.PI / 180, 2.5 * Math.PI / 180);
          ctx.lineTo(0, 0);
          ctx.fillStyle = bot.id === 'player' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(239, 68, 68, 0.1)';
          ctx.fill();

          // Laser Sight (Center line)
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

      // Draw Bots
      bots.forEach(bot => {
        if (bot.health <= 0) return; // Dead bots don't render or render as wreckage

        ctx.save();
        ctx.translate(bot.x, bot.y);
        
        // Bars Container
        // Health Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(-20, -40, 40, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-20, -40, 40 * (bot.health / 100), 4);

        // Heat Bar
        ctx.fillStyle = '#334155'; // Bg
        ctx.fillRect(-20, -35, 40, 3);
        // Color shift from yellow to red based on heat
        ctx.fillStyle = bot.overheated ? '#ef4444' : '#f59e0b';
        ctx.fillRect(-20, -35, 40 * (bot.heat / 100), 3);

        // Overheat Indicator
        if (bot.overheated) {
           ctx.font = 'bold 10px monospace';
           ctx.fillStyle = '#ef4444';
           ctx.textAlign = 'center';
           ctx.fillText('JAMMED!', 0, -45);
        }

        // Bot Body
        ctx.rotate((bot.angle * Math.PI) / 180);
        
        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = bot.color;
        
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.rect(-ROBOT_RADIUS, -ROBOT_RADIUS, ROBOT_RADIUS*2, ROBOT_RADIUS*2);
        ctx.fill();
        ctx.strokeStyle = bot.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Direction Indicator
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-5, 5);
        ctx.fillStyle = bot.color;
        ctx.fill();

        ctx.restore();

        // Turret (Independent rotation)
        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate((bot.turretAngle * Math.PI) / 180);
        
        ctx.fillStyle = bot.overheated ? '#7f1d1d' : '#94a3b8'; // Dark red if jammed
        ctx.fillRect(0, -3, 25, 6); // Barrel
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.stroke();
        
        ctx.restore();
      });

      // Draw Projectiles
      projectiles.forEach(p => {
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'orange';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fill();
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
  }, [bots, projectiles, explosions, config, status]);

  return (
    <canvas 
      ref={canvasRef} 
      width={config.width} 
      height={config.height}
      className="rounded-lg border-2 border-slate-700 shadow-2xl"
    />
  );
};