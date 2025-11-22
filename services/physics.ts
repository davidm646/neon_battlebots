
import { RobotState, Projectile, Explosion, LaserBeam } from '../types';
import { VM } from './vm';
import { audio } from './audio';
import { 
  ARENA_WIDTH, ARENA_HEIGHT, ROBOT_RADIUS, PROJECTILE_SPEED, PROJECTILE_RADIUS, 
  DAMAGE_PER_SHOT, HEAT_PER_SHOT, HEAT_DECAY, MAX_HEAT, TURRET_SPEED, TURN_SPEED,
  COLLISION_DAMAGE_FACTOR, WALL_DAMAGE_FACTOR, COLLISION_BOUNCE,
  COLLISION_DAMAGE_THRESHOLD, COLLISION_COOLDOWN,
  LASER_DAMAGE, LASER_HEAT, LASER_FADE_FRAMES, LASER_COLOR, SCAN_RANGE
} from '../constants';

export class PhysicsEngine {
  static update(
    bots: RobotState[], 
    projectiles: Projectile[], 
    explosions: Explosion[],
    lasers: LaserBeam[] = [],
    cycles: number = 5
  ): { bots: RobotState[], projectiles: Projectile[], explosions: Explosion[], lasers: LaserBeam[] } {
    
    // Clone arrays
    const currentBots = [...bots];
    let currentProjs = [...projectiles];
    let currentExplosions = [...explosions];
    let currentLasers = [...lasers];
    
    let totalBotSpeed = 0;

    // 1. Run VM and Logic
    currentBots.forEach(bot => {
      if (bot.health <= 0) return;
      
      // Increment Time Register
      const time = bot.registers.get('TIME') || 0;
      bot.registers.set('TIME', time + 1);

      // Aggregate speed for audio
      totalBotSpeed += bot.speed;

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

      // --- Movement Physics ---
      
      // 1. Chassis Rotation Smoothing
      let diffAngle = bot.desiredAngle - bot.angle;
      while (diffAngle <= -180) diffAngle += 360;
      while (diffAngle > 180) diffAngle -= 360;

      if (Math.abs(diffAngle) < TURN_SPEED) {
        bot.angle = bot.desiredAngle;
      } else {
        bot.angle += Math.sign(diffAngle) * TURN_SPEED;
      }
      bot.angle = (bot.angle + 360) % 360;

      // 2. Move Forward (based on physical angle)
      const rad = (bot.angle * Math.PI) / 180;
      bot.x += Math.cos(rad) * (bot.speed / 2); 
      bot.y += Math.sin(rad) * (bot.speed / 2);

      // 3. Turret Rotation Smoothing
      let diffTurret = bot.desiredTurretAngle - bot.turretAngle;
      while (diffTurret <= -180) diffTurret += 360;
      while (diffTurret > 180) diffTurret -= 360;

      if (Math.abs(diffTurret) < TURRET_SPEED) {
        bot.turretAngle = bot.desiredTurretAngle;
      } else {
        bot.turretAngle += Math.sign(diffTurret) * TURRET_SPEED;
      }
      bot.turretAngle = (bot.turretAngle + 360) % 360;

      // Firing Logic
      const shootVal = bot.registers.get('SHOOT');
      if (shootVal && !bot.overheated) {
         const turretRad = (bot.turretAngle * Math.PI) / 180;
         const barrelTipX = bot.x + Math.cos(turretRad) * 25;
         const barrelTipY = bot.y + Math.sin(turretRad) * 25;

         // FIRE 1: Standard Projectile
         if (shootVal === 1) {
             currentProjs.push({
               id: Math.random().toString(),
               ownerId: bot.id,
               x: barrelTipX,
               y: barrelTipY,
               vx: Math.cos(turretRad) * PROJECTILE_SPEED,
               vy: Math.sin(turretRad) * PROJECTILE_SPEED,
               damage: DAMAGE_PER_SHOT,
               active: true
             });

             audio.playShoot();
             bot.heat += HEAT_PER_SHOT;
         } 
         // FIRE 2: Laser (Hitscan)
         else if (shootVal === 2) {
             // Raycast Logic
             let closestDist = SCAN_RANGE; // Max range
             let hitX = barrelTipX + Math.cos(turretRad) * SCAN_RANGE;
             let hitY = barrelTipY + Math.sin(turretRad) * SCAN_RANGE;
             let hitBot: RobotState | null = null;

             const dirX = Math.cos(turretRad);
             const dirY = Math.sin(turretRad);

             // 1. Check Walls (Line Intersection)
             // X intersection
             if (dirX !== 0) {
                let wallX = dirX > 0 ? ARENA_WIDTH : 0;
                let dist = (wallX - barrelTipX) / dirX;
                if (dist > 0 && dist < closestDist) {
                   // Check if Y is within height
                   let wallY = barrelTipY + dist * dirY;
                   if (wallY >= 0 && wallY <= ARENA_HEIGHT) {
                      closestDist = dist;
                      hitX = wallX;
                      hitY = wallY;
                   }
                }
             }
             // Y intersection
             if (dirY !== 0) {
                let wallY = dirY > 0 ? ARENA_HEIGHT : 0;
                let dist = (wallY - barrelTipY) / dirY;
                if (dist > 0 && dist < closestDist) {
                   let wallX = barrelTipX + dist * dirX;
                   if (wallX >= 0 && wallX <= ARENA_WIDTH) {
                      closestDist = dist;
                      hitX = wallX;
                      hitY = wallY;
                   }
                }
             }

             // 2. Check Bots (Line-Circle Intersection)
             currentBots.forEach(other => {
               if (other.id === bot.id || other.health <= 0) return;
               
               // Vector from ray start to circle center
               const fX = barrelTipX - other.x;
               const fY = barrelTipY - other.y;
               
               const a = dirX * dirX + dirY * dirY; // Should be 1 if normalized
               const b = 2 * (fX * dirX + fY * dirY);
               const c = (fX * fX + fY * fY) - (ROBOT_RADIUS * ROBOT_RADIUS);
               
               let discriminant = b*b - 4*a*c;
               
               if(discriminant >= 0) {
                 // Ray intersects circle
                 discriminant = Math.sqrt(discriminant);
                 const t1 = (-b - discriminant) / (2*a);
                 const t2 = (-b + discriminant) / (2*a);
                 
                 // Logic Check: 
                 // t1 is usually entry, t2 is exit.
                 // If t1 < 0, it means entry is behind us (we are inside the bot), so we check t2.
                 
                 let tHit = -1;
                 if (t1 >= 0) {
                    tHit = t1;
                 } else if (t2 >= 0) {
                    // Point blank shot / Inside hitbox
                    tHit = t2;
                 }
                 
                 if(tHit >= 0 && tHit < closestDist) {
                    closestDist = tHit;
                    hitX = barrelTipX + tHit * dirX;
                    hitY = barrelTipY + tHit * dirY;
                    hitBot = other;
                 }
               }
             });

             // Apply Hit
             if (hitBot) {
                hitBot.health -= LASER_DAMAGE;
                audio.playHit();
                currentExplosions.push({
                    id: Math.random().toString(),
                    x: hitX, y: hitY, radius: 5, maxRadius: 15, life: 1, color: '#22d3ee'
                });
                if (hitBot.health <= 0) audio.playExplosion();
             }

             // Create Laser Visual
             currentLasers.push({
               id: Math.random().toString(),
               ownerId: bot.id,
               x1: barrelTipX,
               y1: barrelTipY,
               x2: hitX,
               y2: hitY,
               color: LASER_COLOR,
               life: 1
             });

             audio.playLaser();
             bot.heat += LASER_HEAT;
         }

         // Common heat check
         if (bot.heat >= MAX_HEAT) {
           bot.heat = MAX_HEAT;
           bot.overheated = true;
         }
      }
      bot.registers.set('SHOOT', 0);
    });
    
    audio.updateEngine(totalBotSpeed);

    // 2. Collision Resolution
    
    currentBots.forEach((bot, i) => {
       if (bot.health <= 0) return;
       
       // Wall
       let hitWall = false;
       if (bot.x < ROBOT_RADIUS) { bot.x = ROBOT_RADIUS; hitWall = true; } 
       else if (bot.x > ARENA_WIDTH - ROBOT_RADIUS) { bot.x = ARENA_WIDTH - ROBOT_RADIUS; hitWall = true; }
       if (bot.y < ROBOT_RADIUS) { bot.y = ROBOT_RADIUS; hitWall = true; }
       else if (bot.y > ARENA_HEIGHT - ROBOT_RADIUS) { bot.y = ARENA_HEIGHT - ROBOT_RADIUS; hitWall = true; }

       if (hitWall && bot.speed > 0) {
         if (bot.speed > COLLISION_DAMAGE_THRESHOLD && bot.collisionCooldown === 0) {
            bot.health -= bot.speed * WALL_DAMAGE_FACTOR;
            bot.collisionCooldown = COLLISION_COOLDOWN;
            audio.playCrash();
         }
         bot.speed = Math.floor(bot.speed * COLLISION_BOUNCE);
         bot.registers.set('SPEED', bot.speed);
       }

       // Bots
       for (let j = i + 1; j < currentBots.length; j++) {
         const other = currentBots[j];
         if (other.health <= 0) continue;

         const dx = other.x - bot.x;
         const dy = other.y - bot.y;
         const dist = Math.sqrt(dx*dx + dy*dy);
         const minDist = ROBOT_RADIUS * 2;

         if (dist < minDist) {
           const angle = Math.atan2(dy, dx);
           const overlap = minDist - dist;
           const moveX = (Math.cos(angle) * overlap) / 2;
           const moveY = (Math.sin(angle) * overlap) / 2;
           
           bot.x -= moveX; bot.y -= moveY;
           other.x += moveX; other.y += moveY;

           const v1x = Math.cos(bot.angle * Math.PI / 180) * bot.speed;
           const v1y = Math.sin(bot.angle * Math.PI / 180) * bot.speed;
           const v2x = Math.cos(other.angle * Math.PI / 180) * other.speed;
           const v2y = Math.sin(other.angle * Math.PI / 180) * other.speed;

           const relVx = v1x - v2x;
           const relVy = v1y - v2y;
           const impactSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

           if (impactSpeed > COLLISION_DAMAGE_THRESHOLD) {
              if (bot.collisionCooldown === 0 && other.collisionCooldown === 0) {
                 const damage = impactSpeed * COLLISION_DAMAGE_FACTOR;
                 bot.health -= damage;
                 other.health -= damage;
                 bot.collisionCooldown = COLLISION_COOLDOWN;
                 other.collisionCooldown = COLLISION_COOLDOWN;
                 audio.playCrash();
                 currentExplosions.push({
                    id: Math.random().toString(),
                    x: bot.x + dx/2, y: bot.y + dy/2, radius: 10, maxRadius: 25, life: 1, color: '#cbd5e1'
                 });
              }
           }

           bot.speed = Math.floor(bot.speed * COLLISION_BOUNCE);
           other.speed = Math.floor(other.speed * COLLISION_BOUNCE);
           bot.registers.set('SPEED', bot.speed);
           other.registers.set('SPEED', other.speed);
         }
       }
    });

    // 3. Projectiles
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
          audio.playHit();
          if (bot.health <= 0) audio.playExplosion();
          currentExplosions.push({
            id: Math.random().toString(),
            x: p.x, y: p.y, radius: 5, maxRadius: 20, life: 1, color: '#f59e0b'
          });
        }
      });
    });
    currentProjs = currentProjs.filter(p => p.active);

    // 4. Explosions
    currentExplosions.forEach(e => { e.life -= 0.05; e.radius += 2; });
    currentExplosions = currentExplosions.filter(e => e.life > 0);

    // 5. Lasers Update
    currentLasers.forEach(l => {
       l.life -= 1 / LASER_FADE_FRAMES;
    });
    currentLasers = currentLasers.filter(l => l.life > 0);

    return { bots: currentBots, projectiles: currentProjs, explosions: currentExplosions, lasers: currentLasers };
  }
}