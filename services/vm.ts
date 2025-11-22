
import { RobotState, OpCode, Instruction } from '../types';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../constants';
import { Compiler } from './compiler';

export class VM {
  static createRobot(id: string, color: string, code: string, x: number, y: number): RobotState {
    const { program, labels } = Compiler.parse(code);
    
    const regs = new Map<string, number>();
    
    // 1. Initialize System Registers (Read/Write & Read-Only)
    // These are the ONLY "official" registers.
    const systemRegs = ['X', 'Y', 'SPEED', 'ANGLE', 'TURRET', 'SHOOT', 'RADAR', 'HEAT', 'TIME', 'HEALTH'];
    systemRegs.forEach(r => regs.set(r, 0));

    // 2. Dynamically scan program for User Variables
    // Any argument that is NOT a Number, NOT a Label, and NOT a System Register is a User Variable.
    program.forEach((instr: Instruction) => {
      instr.args.forEach(arg => {
        if (!arg) return;
        const upperArg = arg.toUpperCase();
        
        const isNumber = /^-?\d+$/.test(upperArg);
        const isLabel = labels.has(upperArg);
        const isSystemReg = regs.has(upperArg);

        if (!isNumber && !isLabel && !isSystemReg) {
          // Initialize variable to 0 if not already present
          if (!regs.has(upperArg)) {
            regs.set(upperArg, 0);
          }
        }
      });
    });

    return {
      id, color, x, y, angle: 0, speed: 0, turretAngle: 0, desiredTurretAngle: 0,
      health: 100, energy: 100, radius: 20,
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
      lastScanResult: 0, // Default to 0 (nothing found) instead of -1
      lastScanAngle: 0,
      lastScanTime: -999 // Never scanned
    };
  }

  static step(bot: RobotState, allBots: RobotState[], executionCycles: number = 5): void {
    if (bot.health <= 0) return;

    // Update Read-Only Registers with Physics State
    bot.registers.set('X', Math.floor(bot.x));
    bot.registers.set('Y', Math.floor(bot.y));
    bot.registers.set('HEALTH', Math.floor(bot.health));
    bot.registers.set('HEAT', Math.floor(bot.heat));
    
    // Ensure sensors are up to date before code execution
    // RADAR is updated by SCAN command, but we sync the last result just in case
    bot.registers.set('RADAR', bot.lastScanResult); 

    for (let i = 0; i < executionCycles; i++) {
      if (bot.pc >= bot.program.length) {
        bot.pc = 0; // Loop
      }

      const instr = bot.program[bot.pc];
      if (!instr) break;

      VM.executeInstruction(bot, instr, allBots);
      bot.pc++;
    }

    // Apply Physics from Registers to Bot State
    // Clamp Speed 0-10
    bot.speed = Math.max(0, Math.min(10, bot.registers.get('SPEED') || 0));
    
    // Normalize Angles 0-360
    let angle = bot.registers.get('ANGLE') || 0;
    bot.angle = (angle % 360 + 360) % 360;
    
    // Set Desired Turret Angle from Register (Physics loop handles smoothness)
    let turret = bot.registers.get('TURRET') || 0;
    bot.desiredTurretAngle = (turret % 360 + 360) % 360;
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
        // Compare Register r1 with Value/Register val
        const v1 = bot.registers.get(r1) || 0; // Assuming first arg is always reg in CMP
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
        // SCAN angle
        // args[0] is angle (value or register)
        const scanAngle = VM.getVal(bot, args[0]);
        bot.lastScanResult = VM.performScan(bot, scanAngle, allBots);
        bot.registers.set('RADAR', bot.lastScanResult);
        
        // Visual Event Tracking
        bot.lastScanAngle = (scanAngle % 360 + 360) % 360;
        bot.lastScanTime = bot.registers.get('TIME') || 0;
        break;
    }
  }

  private static performScan(bot: RobotState, angle: number, allBots: RobotState[]): number {
    let minDist = 9999;

    for (const other of allBots) {
      if (other.id === bot.id || other.health <= 0) continue;
      
      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate angle to target
      const angleToBot = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      
      // Normalize scan angle
      const normScanAngle = (angle % 360 + 360) % 360;

      // Cone check (5 degrees total width, +/- 2.5 degrees)
      const angleDiff = Math.abs(angleToBot - normScanAngle);
      const wrappedDiff = Math.min(angleDiff, 360 - angleDiff);

      if (wrappedDiff < 2.5) {
        if (dist < minDist) minDist = dist;
      }
    }

    // Return 0 if nothing found (standard for RobotWar style scanners)
    return minDist === 9999 ? 0 : Math.floor(minDist);
  }
}
