
import { RobotState, OpCode, Instruction } from '../types';
import { AMMO_PROJECTILE, AMMO_LASER, AMMO_MISSILE, WEAPON_PROJECTILE, WEAPON_LASER, WEAPON_MISSILE, MISSILE_LOCK_DURATION } from '../constants';
import { Compiler } from './compiler';
import { audio } from './audio';

export class VM {
  static createRobot(id: string, color: string, code: string, x: number, y: number): RobotState {
    const { program, labels } = Compiler.parse(code);
    
    const regs = new Map<string, number>();
    
    // Randomize initial orientation
    const startAngle = Math.floor(Math.random() * 360);
    const startTurret = Math.floor(Math.random() * 360);

    // 1. Initialize System Registers (Read/Write & Read-Only)
    const systemRegs = [
      'X', 'Y', 'SPEED', 'ANGLE', 'TURRET', 
      'SHOOT', 'RADAR', 'HEAT', 'TIME', 'HEALTH', 
      'WEAPON', 'AMMO'
    ];
    systemRegs.forEach(r => regs.set(r, 0));
    
    // Defaults
    regs.set('ANGLE', startAngle);
    regs.set('TURRET', startTurret);
    regs.set('WEAPON', WEAPON_PROJECTILE); // Default to Weapon 1

    // 2. Dynamically scan program for User Variables
    program.forEach((instr: Instruction) => {
      instr.args.forEach(arg => {
        if (!arg) return;
        const upperArg = arg.toUpperCase();
        const isNumber = /^-?\d+$/.test(upperArg);
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
      id, color, x, y, 
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
      cmpFlag: 0,
      scanCooldown: 0,
      shootCooldown: 0,
      lastScanResult: 0,
      lastScanAngle: 0,
      lastScanTime: -999
    };
  }

  static step(bot: RobotState, allBots: RobotState[], executionCycles: number = 5): void {
    if (bot.health <= 0) return;

    // --- Sync Physics -> Registers (Read Only) ---
    bot.registers.set('X', Math.floor(bot.x));
    bot.registers.set('Y', Math.floor(bot.y));
    bot.registers.set('HEALTH', Math.floor(bot.health));
    bot.registers.set('HEAT', Math.floor(bot.heat));
    bot.registers.set('RADAR', bot.lastScanResult); 
    
    // Sync Weapon/Ammo Registers
    // Note: activeWeapon is the source of truth for the physics engine, 
    // but we let the register reflect it for the debugger.
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

    // --- Sync Registers -> Physics (Write) ---
    // Movement
    bot.speed = Math.max(0, Math.min(10, bot.registers.get('SPEED') || 0));
    
    let angle = bot.registers.get('ANGLE') || 0;
    bot.desiredAngle = (angle % 360 + 360) % 360;
    
    let turret = bot.registers.get('TURRET') || 0;
    bot.desiredTurretAngle = (turret % 360 + 360) % 360;

    // Weapon Selection
    const requestedWeapon = bot.registers.get('WEAPON');
    if (requestedWeapon && [WEAPON_PROJECTILE, WEAPON_LASER, WEAPON_MISSILE].includes(requestedWeapon)) {
      bot.activeWeapon = requestedWeapon;
    }
  }

  private static getVal(bot: RobotState, arg: string): number {
    const parsed = parseInt(arg);
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
        bot.registers.set(r1, Math.floor((bot.registers.get(r1) || 0) * val));
        break;
      case OpCode.DIV:
        if (val !== 0) bot.registers.set(r1, Math.floor((bot.registers.get(r1) || 0) / val));
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

    for (const other of allBots) {
      if (other.id === bot.id || other.health <= 0) continue;
      
      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const angleToBot = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const normScanAngle = (angle % 360 + 360) % 360;

      const angleDiff = Math.abs(angleToBot - normScanAngle);
      const wrappedDiff = Math.min(angleDiff, 360 - angleDiff);

      if (wrappedDiff < 2.5) {
        if (dist < minDist) {
           minDist = dist;
           foundBotId = other.id;
        }
      }
    }
    
    // Target Lock Logic
    if (foundBotId) {
      bot.targetLockId = foundBotId;
      bot.lockTimer = MISSILE_LOCK_DURATION;
    }

    return minDist === 9999 ? 0 : Math.floor(minDist);
  }
}
