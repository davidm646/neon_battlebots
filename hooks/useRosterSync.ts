import { useEffect } from 'react';
import { BotConfig, GameStatus, RobotState } from '../types';
import { VM } from '../services/vm';
import { getSafeSpawnPoint } from '../services/spawner';

export const useRosterSync = (
  roster: BotConfig[],
  status: GameStatus,
  setBots: React.Dispatch<React.SetStateAction<RobotState[]>>,
  botsRef: React.MutableRefObject<RobotState[]>
) => {
  useEffect(() => {
    // Only sync if we are NOT running or paused.
    // We also allow sync in READY state to update code, but we must be careful about positions.
    if (status === GameStatus.RUNNING || status === GameStatus.PAUSED) return;

    setBots(currentBots => {
       const nextBots: RobotState[] = [];

       roster.forEach(config => {
          const existing = currentBots.find(b => b.id === config.id);
          
          if (existing) {
            // Update VM (in case code changed) but Keep Position
            const vmBot = VM.createRobot(config.id, config.color, config.code, existing.x, existing.y);
            
            // CRITICAL: We must sync the registers to match the existing physical state.
            // Since createRobot() now randomizes orientation, we must override it with the
            // existing bot's orientation to prevent it from snapping to a random angle on code edit.
            vmBot.registers.set('ANGLE', existing.angle);
            vmBot.registers.set('TURRET', existing.turretAngle);
            // Also sync TIME if we are just sitting in READY/STOPPED state so it doesn't jitter
            vmBot.registers.set('TIME', existing.registers.get('TIME') || 0);
            
            nextBots.push({
              ...vmBot,
              x: existing.x,
              y: existing.y,
              angle: existing.angle,
              desiredAngle: existing.desiredAngle, // Keep target angle
              turretAngle: existing.turretAngle,
              desiredTurretAngle: existing.desiredTurretAngle,
              // PRESERVE PHYSICAL STATE:
              // Prevents dead bots from reviving (reappearing) when code is synced on Game Over
              health: existing.health,
              heat: existing.heat,
              overheated: existing.overheated,
              collisionCooldown: existing.collisionCooldown
            });
          } else {
            // New Bot: Random Position (Safe Check)
            const { x, y } = getSafeSpawnPoint(nextBots);
            // New bots get random headings from createRobot() automatically
            nextBots.push(VM.createRobot(config.id, config.color, config.code, x, y));
          }
       });
       
       botsRef.current = nextBots;
       return nextBots;
    });

  }, [roster, status, setBots, botsRef]);
};