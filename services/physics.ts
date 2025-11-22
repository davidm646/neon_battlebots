
import { RobotState, Projectile, Explosion } from '../types';
import { VM } from './vm';
import { 
  ARENA_WIDTH, ARENA_HEIGHT, ROBOT_RADIUS, PROJECTILE_SPEED, PROJECTILE_RADIUS, 
  DAMAGE_PER_SHOT, HEAT_PER_SHOT, HEAT_DECAY, MAX_HEAT, TURRET_SPEED, 
  COLLISION_DAMAGE_FACTOR, WALL_DAMAGE_FACTOR, COLLISION_BOUNCE,
  COLLISION_DAMAGE_THRESHOLD, COLLISION_COOLDOWN
} from '../constants';

export class PhysicsEngine {
  static update(
    bots: RobotState[], 
    projectiles: Projectile[], 
    explosions: Explosion[],
    cycles: number = 5
  ): { bots: RobotState[], projectiles: Projectile[], explosions: Explosion[] } {
    
    // We clone the arrays for safety, though objects are mutated
    const currentBots = [...bots];
    let currentProjs = [...projectiles];
    let currentExplosions = [...explosions];

    // 1. Run VM and Logic
    currentBots.forEach(bot => {
      if (bot.health <= 0) return;

      // Cooldowns
      if (bot.heat > 0) {
        bot.heat = Math.max(0, bot.heat - HEAT_DECAY);
      }
      if (bot.overheated && bot.heat <= 0) {
        bot.overheated = false;
      }
      if (bot.collisionCooldown > 0) {
        bot.collisionCooldown--;
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
         // Only take damage if hitting hard and not in cooldown
         if (bot.speed > COLLISION_DAMAGE_THRESHOLD && bot.collisionCooldown === 0) {
            bot.health -= bot.speed * WALL_DAMAGE_FACTOR;
            bot.collisionCooldown = COLLISION_COOLDOWN;
         }
         
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

           // 2. Calculate Impact Vector
           const v1x = Math.cos(bot.angle * Math.PI / 180) * bot.speed;
           const v1y = Math.sin(bot.angle * Math.PI / 180) * bot.speed;
           const v2x = Math.cos(other.angle * Math.PI / 180) * other.speed;
           const v2y = Math.sin(other.angle * Math.PI / 180) * other.speed;

           const relVx = v1x - v2x;
           const relVy = v1y - v2y;
           const impactSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

           // 3. Apply Damage only if impact is significant and not in cooldown
           if (impactSpeed > COLLISION_DAMAGE_THRESHOLD) {
              if (bot.collisionCooldown === 0 && other.collisionCooldown === 0) {
                 const damage = impactSpeed * COLLISION_DAMAGE_FACTOR;
                 bot.health -= damage;
                 other.health -= damage;
                 
                 // Safety cooldown to prevent "grinding" death
                 bot.collisionCooldown = COLLISION_COOLDOWN;
                 other.collisionCooldown = COLLISION_COOLDOWN;
                 
                 // Visuals (Explosion at midpoint)
                 const midX = bot.x + (dx / 2);
                 const midY = bot.y + (dy / 2);
                 currentExplosions.push({
                    id: Math.random().toString(),
                    x: midX, y: midY, radius: 10, maxRadius: 25, life: 1, color: '#cbd5e1' // White/Smoke sparks
                 });
              }
           }

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

    return { bots: currentBots, projectiles: currentProjs, explosions: currentExplosions };
  }
}
