
export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
export const ROBOT_RADIUS = 20;
export const PROJECTILE_SPEED = 12;
export const PROJECTILE_RADIUS = 4;
export const MAX_HEALTH = 100;
export const DAMAGE_PER_SHOT = 10;
export const SCAN_RANGE = 900; // Infinite basically

// Collision Physics
export const COLLISION_DAMAGE_FACTOR = 0.5; // Reduced factor
export const WALL_DAMAGE_FACTOR = 0.5;      // Reduced factor
export const COLLISION_BOUNCE = 0.5;        // Speed retained after collision (0.5 = 50% speed loss)
export const COLLISION_DAMAGE_THRESHOLD = 3; // Min impact speed to cause damage
export const COLLISION_COOLDOWN = 30;       // Frames of invulnerability after a crash (0.5s)

// Heat System Balance
export const MAX_HEAT = 100;
export const HEAT_PER_SHOT = 20;
export const HEAT_DECAY = 1.0; // Per Frame

// Physics Balance
export const TURRET_SPEED = 10; // Degrees per frame
export const TURN_SPEED = 5;    // Degrees per frame (Chassis)

export const BOT_PALETTE = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
];

export const DEFAULT_OPCODE_HELP = `
Language: Assembly-like. Case insensitive.
5 Instructions executed per 60fps frame.

Commands:
SET reg val   : Set register/var
ADD reg val   : Add to register
SUB reg val   : Subtract
MUL reg val   : Multiply
DIV reg val   : Divide
CMP a b       : Compare a vs b. Sets flags for JGT/JLT/JEQ
JMP label     : Jump always
JGT label     : Jump if a > b
JLT label     : Jump if a < b
JEQ label     : Jump if a == b
SCAN angle    : Puts distance in RADAR (0 if none)

System Registers (Controls):
SPEED (0-10), ANGLE (0-360), TURRET (0-360), SHOOT (0/1)

System Registers (Sensors):
RADAR, HEAT, X, Y, HEALTH, TIME

Aliases:
AIM x  -> SET TURRET x
MOVE x -> SET SPEED x
TURN x -> SET ANGLE x
FIRE 1 -> SET SHOOT 1
`;

export const DEFAULT_BOT_SCRIPT = `
; Default Sentry
START:
  SET aim 0

LOOP:
  ADD aim 10
  AIM aim
  
  ; Heat Management
  CMP heat 80
  JGT COOL_DOWN
  
  SCAN aim
  CMP radar 0
  JGT ATTACK
  
  JMP LOOP

ATTACK:
  FIRE 1
  ADD aim 5
  JMP LOOP

COOL_DOWN:
  SET speed 5
  JMP LOOP
`;

export const TARGET_BOT_SCRIPT = `
; Moving Target
START:
  SET speed 5
  SET head 45

LOOP:
  ADD head 2
  TURN head
  
  ; Wall Check
  CMP x 50
  JLT BOUNCE
  CMP x 750
  JGT BOUNCE
  CMP y 50
  JLT BOUNCE
  CMP y 550
  JGT BOUNCE
  
  JMP LOOP

BOUNCE:
  ADD head 120
  TURN head
  JMP LOOP
`;
