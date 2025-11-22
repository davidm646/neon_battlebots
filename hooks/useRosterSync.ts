
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
    if (status === GameStatus.RUNNING || status === GameStatus.PAUSED) return;

    setBots(currentBots => {
       const nextBots: RobotState[] = [];

       roster.forEach(config => {
          const existing = currentBots.find(b => b.id === config.id);
          
          if (existing) {
            // Update VM but Keep Position
            const vmBot = VM.createRobot(config.id, config.color, config.code, existing.x, existing.y);
            
            // Sync registers for position/orientation
            vmBot.registers.set('ANGLE', existing.angle);
            vmBot.registers.set('TURRET', existing.turretAngle);
            
            // Determine if we should preserve combat state (Health, Heat, Ammo, etc)
            // We preserve state ONLY if the game is STOPPED or GAME_OVER (post-match analysis).
            // If we are in READY state (preparing for battle), we force a reset of stats
            // so the bot is fully repaired and reloaded.
            const shouldPreserveStats = status !== GameStatus.READY;

            if (shouldPreserveStats) {
               // If preserving, we must update the fresh VM registers to match the old physical state
               // so the Debugger Panel shows the correct damaged values immediately.
               vmBot.registers.set('HEALTH', existing.health);
               vmBot.registers.set('HEAT', existing.heat);
               vmBot.registers.set('WEAPON', existing.activeWeapon);
               vmBot.registers.set('AMMO', existing.ammo[existing.activeWeapon] || 0);
               vmBot.registers.set('TIME', existing.registers.get('TIME') || 0);
            } else {
               // If Resetting (READY), ensure TIME is 0
               vmBot.registers.set('TIME', 0);
            }
            
            nextBots.push({
              ...vmBot,
              // Always keep position/orientation during sync
              x: existing.x,
              y: existing.y,
              angle: existing.angle,
              desiredAngle: existing.desiredAngle,
              turretAngle: existing.turretAngle,
              desiredTurretAngle: existing.desiredTurretAngle,
              
              // Conditional State Preservation
              health: shouldPreserveStats ? existing.health : vmBot.health, // vmBot has 100
              heat: shouldPreserveStats ? existing.heat : vmBot.heat,       // vmBot has 0
              overheated: shouldPreserveStats ? existing.overheated : vmBot.overheated,
              collisionCooldown: shouldPreserveStats ? existing.collisionCooldown : vmBot.collisionCooldown,
              ammo: shouldPreserveStats ? existing.ammo : vmBot.ammo,
              targetLockId: shouldPreserveStats ? existing.targetLockId : vmBot.targetLockId,
              lockTimer: shouldPreserveStats ? existing.lockTimer : vmBot.lockTimer,
              
              // Preserve Missile Reload
              missileReloadTimer: shouldPreserveStats ? existing.missileReloadTimer : vmBot.missileReloadTimer,
              
              // Weapon selection preservation
              activeWeapon: shouldPreserveStats ? existing.activeWeapon : vmBot.activeWeapon
            });
          } else {
            // New Bot: Random Position (Safe Check)
            const { x, y } = getSafeSpawnPoint(nextBots);
            const newBot = VM.createRobot(config.id, config.color, config.code, x, y);
            newBot.registers.set('TIME', 0);
            nextBots.push(newBot);
          }
       });
       
       botsRef.current = nextBots;
       return nextBots;
    });

  }, [roster, status, setBots, botsRef]);
};
