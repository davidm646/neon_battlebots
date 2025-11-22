export enum OpCode {
  SET = 'SET',     // SET reg value
  ADD = 'ADD',     // ADD reg value
  SUB = 'SUB',     // SUB reg value
  MUL = 'MUL',     // MUL reg value
  DIV = 'DIV',     // DIV reg value
  JMP = 'JMP',     // JMP label
  JGT = 'JGT',     // JGT label (Jump if register > 0 or compare flag set)
  JLT = 'JLT',     // JLT label
  JEQ = 'JEQ',     // JEQ label
  CMP = 'CMP',     // CMP reg value
  SCAN = 'SCAN',   // SCAN reg (puts distance in RADAR reg)
  NOOP = 'NOOP'
}

export interface Instruction {
  op: OpCode;
  args: string[];
  originalLine?: number;
}

export interface RobotState {
  id: string;
  color: string;
  x: number;
  y: number;
  angle: number;       // Degrees 0-360
  speed: number;       // 0-100
  turretAngle: number; // Relative to bot or absolute? Absolute for simplicity.
  health: number;
  energy: number;
  radius: number;
  
  // VM State
  registers: Map<string, number>;
  pc: number; // Program Counter
  program: Instruction[];
  labels: Map<string, number>;
  cmpFlag: number; // -1 less, 0 equal, 1 greater
  
  // Cooldowns
  scanCooldown: number;
  shootCooldown: number;
  lastScanResult: number; // Distance to nearest object
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  active: boolean;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number; // 0-1
  color: string;
}

export interface GameConfig {
  width: number;
  height: number;
  fps: number;
}

export enum GameStatus {
  STOPPED = 'STOPPED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}