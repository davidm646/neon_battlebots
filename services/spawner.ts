import { ARENA_WIDTH, ARENA_HEIGHT, ROBOT_RADIUS } from '../constants';

export const getSafeSpawnPoint = (existingBots: {x: number, y: number}[]) => {
  const margin = 50; // Safe distance from walls
  const minSeparation = ROBOT_RADIUS * 3; // Distance between centers (prevent overlaps)
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
    const y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
    
    const collision = existingBots.some(b => {
      const dx = b.x - x;
      const dy = b.y - y;
      return Math.sqrt(dx * dx + dy * dy) < minSeparation;
    });

    if (!collision) return { x, y };
    attempts++;
  }
  
  // Fallback if arena is too crowded (rare)
  return { 
      x: margin + Math.random() * (ARENA_WIDTH - margin * 2),
      y: margin + Math.random() * (ARENA_HEIGHT - margin * 2)
  };
};