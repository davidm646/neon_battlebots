
import { RobotState, OpCode, Instruction } from '../types';
import { AMMO_PROJECTILE, AMMO_LASER, AMMO_MISSILE, WEAPON_PROJECTILE, WEAPON_LASER, WEAPON_MISSILE, MISSILE_LOCK_DURATION, SCAN_CONE_WIDTH } from '../constants';
import { Compiler } from './compiler';
import { audio } from './audio';

export class VM {
  static createRobot(id: string, name: string, color: string, code: string, x: number, y: number): RobotState {
    const { program, labels, error } = Compiler.parse(code);
    
    const regs = new Map<string, number>();
    
    // Randomize initial orientation
    const startAngle = Math.floor(Math.random() * 360);
    const startTurret = Math.floor(Math.random() * 360);

    // 1. Initialize System Registers (Read/Write & Read-Only)
    const systemRegs = [
      'X', 'Y', 'SPEED', 'ANGLE', 'AIM', 'TURRET', // Added AIM
      'SHOOT', 'RADAR', 'HEAT', 'TIME', 'HEALTH', 
      'WEAPON', 'AMMO'
    ];
    systemRegs.forEach(r => regs.set(r, 0));
    
    // Defaults
    regs.set('ANGLE', startAngle);
    regs.set('TURRET', startTurret);
    regs.set('AIM', startTurret); // Initialize AIM to current turret angle
    regs.set('WEAPON', WEAPON_PROJECTILE); // Default to Weapon 1

    // 2. Dynamically scan program for User Variables
    program.forEach((instr: Instruction) => {
      instr.args.forEach(arg => {
        if (!arg) return;
        const upperArg = arg.toUpperCase();
        // Allow floats in code (e.g. 0.5 or -10.5)
        const isNumber = !isNaN(parseFloat(upperArg)) && isFinite(parseFloat(upperArg));
        const isLabel = labels.has(upperArg);
        const isSystemReg = regs.has(upperArg);

        if (!isNumber && !isLabel && !isSystemReg) {
          if (!regs.has(upperArg)) {
            regs.set(upperArg, 0);
          }
        }
      });
    });

    return {
      id, name, color, x, y, 
      angle: startAngle, 
      desiredAngle: startAngle,
      speed: 0, 
      turretAngle: startTurret, 
      desiredTurretAngle: startTurret,
      health: 100, energy: 100, radius: 20,
      
      // Weapon Inventory
      activeWeapon: WEAPON_PROJECTILE,
      ammo: {
        [WEAPON_PROJECTILE]: AMMO_PROJECTILE,
        [WEAPON_LASER]: AMMO_LASER,
        [WEAPON_MISSILE]: AMMO_MISSILE
      },
      missileReloadTimer: 0,
      
      // Missile Lock
      targetLockId: null,
      lockTimer: 0,

      heat: 0,
      overheated: false,
      collisionCooldown: 0,
      registers: regs,
      pc: 0,
      program,
      labels,
      compileError: error || null,
      cmpFlag: 0,
      scanCooldown: 0,
      shootCooldown: 0,
      lastScanResult: -1, // Default to -1 (nothing found)
      lastScanAngle: 0,
      lastScanTime: -999
    };
  }

  static step(bot: RobotState, allBots: RobotState[], executionCycles: number = 5): void {
    if (bot.health <= 0) return;
    if (bot.program.length === 0) return; // No code to execute

    // --- Sync Physics -> Registers (Read Only) ---
    bot.registers.set('X', Math.floor(bot.x));
    bot.registers.set('Y', Math.floor(bot.y));
    bot.registers.set('HEALTH', Math.floor(bot.health));
    bot.registers.set('HEAT', Math.floor(bot.heat));
    bot.registers.set('RADAR', bot.lastScanResult);
    bot.registers.set('TURRET', Math.floor(bot.turretAngle)); // Sync Physical Turret Angle to Sensor Register
    
    // Sync Weapon/Ammo Registers
    bot.registers.set('WEAPON', bot.activeWeapon);
    bot.registers.set('AMMO', bot.ammo[bot.activeWeapon] || 0);

    // --- Execute Code ---
    for (let i = 0; i < executionCycles; i++) {
      if (bot.pc >= bot.program.length) {
        bot.pc = 0; // Loop
      }

      const instr = bot.program[bot.pc];
      if (!instr) break;

      VM.executeInstruction(bot, instr, allBots);
      bot.pc++;
    }

    // --- Register Normalization ---
    const angleReg = bot.registers.get('ANGLE') || 0;
    bot.registers.set('ANGLE', (angleReg % 360 + 360) % 360);

    const aimReg = bot.registers.get('AIM') || 0;
    bot.registers.set('AIM', (aimReg % 360 + 360) % 360);

    const turretReg = bot.registers.get('TURRET') || 0;
    bot.registers.set('TURRET', (turretReg % 360 + 360) % 360);

    // --- Sync Registers -> Physics (Write) ---
    bot.speed = Math.max(0, Math.min(10, bot.registers.get('SPEED') || 0));
    
    let angle = bot.registers.get('ANGLE') || 0;
    bot.desiredAngle = (angle % 360 + 360) % 360;
    
    // Read AIM to set Desired Turret Angle
    let aim = bot.registers.get('AIM') || 0;
    bot.desiredTurretAngle = (aim % 360 + 360) % 360;

    const requestedWeapon = bot.registers.get('WEAPON');
    if (requestedWeapon && [WEAPON_PROJECTILE, WEAPON_LASER, WEAPON_MISSILE].includes(requestedWeapon)) {
      bot.activeWeapon = requestedWeapon;
    }
  }

  private static getVal(bot: RobotState, arg: string): number {
    // Use parseFloat to support floating point inputs like 0.5 or 10.5
    const parsed = parseFloat(arg);
    if (!isNaN(parsed)) return parsed;
    return bot.registers.get(arg.toUpperCase()) || 0;
  }

  private static executeInstruction(bot: RobotState, instr: Instruction, allBots: RobotState[]) {
    const { op, args } = instr;
    const r1 = args[0]?.toUpperCase();
    const val = args[1] ? VM.getVal(bot, args[1]) : 0;

    switch (op) {
      case OpCode.SET:
        bot.registers.set(r1, val);
        break;
      case OpCode.ADD:
        bot.registers.set(r1, (bot.registers.get(r1) || 0) + val);
        break;
      case OpCode.SUB:
        bot.registers.set(r1, (bot.registers.get(r1) || 0) - val);
        break;
      case OpCode.MUL:
        // Removed Math.floor to allow precision math
        bot.registers.set(r1, (bot.registers.get(r1) || 0) * val);
        break;
      case OpCode.DIV:
        if (val !== 0) bot.registers.set(r1, (bot.registers.get(r1) || 0) / val);
        break;
      case OpCode.CMP:
        const v1 = bot.registers.get(r1) || 0;
        if (v1 < val) bot.cmpFlag = -1;
        else if (v1 > val) bot.cmpFlag = 1;
        else bot.cmpFlag = 0;
        break;
      case OpCode.JMP:
        if (bot.labels.has(r1)) bot.pc = bot.labels.get(r1)! - 1;
        break;
      case OpCode.JGT:
        if (bot.cmpFlag === 1 && bot.labels.has(r1)) bot.pc = bot.labels.get(r1)! - 1;
        break;
      case OpCode.JLT:
        if (bot.cmpFlag === -1 && bot.labels.has(r1)) bot.pc = bot.labels.get(r1)! - 1;
        break;
      case OpCode.JEQ:
        if (bot.cmpFlag === 0 && bot.labels.has(r1)) bot.pc = bot.labels.get(r1)! - 1;
        break;
      case OpCode.SCAN:
        const scanAngle = VM.getVal(bot, args[0]);
        // Reduced precision scan cone to +/- 2.0 deg (set in performScan)
        bot.lastScanResult = VM.performScan(bot, scanAngle, allBots);
        bot.registers.set('RADAR', bot.lastScanResult);
        bot.lastScanAngle = (scanAngle % 360 + 360) % 360;
        bot.lastScanTime = bot.registers.get('TIME') || 0;
        break;
    }
  }

  private static performScan(bot: RobotState, angle: number, allBots: RobotState[]): number {
    let minDist = 9999;
    let foundBotId: string | null = null;
    const SCAN_CONE_HALF_WIDTH = SCAN_CONE_WIDTH / 2; 

    for (const other of allBots) {
      // Do not detect self or dead bots
      if (other.id === bot.id || other.health <= 0) continue;
      
      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const angleToBot = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const normScanAngle = (angle % 360 + 360) % 360;

      const angleDiff = Math.abs(angleToBot - normScanAngle);
      const wrappedDiff = Math.min(angleDiff, 360 - angleDiff);

      if (wrappedDiff < SCAN_CONE_HALF_WIDTH) {
        if (dist < minDist) {
           minDist = dist;
           foundBotId = other.id;
        }
      }
    }
    
    if (foundBotId) {
      bot.targetLockId = foundBotId;
      bot.lockTimer = MISSILE_LOCK_DURATION;
    }

    // Return -1 if nothing found, otherwise return integer distance
    return minDist === 9999 ? -1 : Math.floor(minDist);
  }
}
