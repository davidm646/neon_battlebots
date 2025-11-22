
import { Instruction, OpCode } from '../types';

export class Compiler {
  static parse(code: string): { program: Instruction[], labels: Map<string, number>, error?: string } {
    const lines = code.split('\n');
    const program: Instruction[] = [];
    const labels = new Map<string, number>();
    
    // First pass: Identify labels and clean code
    let pc = 0;
    const cleanLines: { text: string, lineNum: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      // Remove comments
      const commentIdx = line.indexOf(';');
      if (commentIdx !== -1) {
        line = line.substring(0, commentIdx).trim();
      }
      
      if (!line) continue;

      // Check for label definition (ends with :)
      if (line.endsWith(':')) {
        const labelName = line.substring(0, line.length - 1).toUpperCase();
        labels.set(labelName, pc);
      } else {
        cleanLines.push({ text: line, lineNum: i + 1 });
        pc++;
      }
    }

    // Second pass: Parse instructions
    for (const { text, lineNum } of cleanLines) {
      const parts = text.split(/\s+/);
      const opRaw = parts[0].toUpperCase();
      const args = parts.slice(1);

      let op = OpCode.NOOP;
      
      // Map simplified commands to Opcodes
      switch (opRaw) {
        case 'SET': op = OpCode.SET; break;
        case 'ADD': op = OpCode.ADD; break;
        case 'SUB': op = OpCode.SUB; break;
        case 'MUL': op = OpCode.MUL; break;
        case 'DIV': op = OpCode.DIV; break;
        case 'JMP': op = OpCode.JMP; break;
        case 'JGT': op = OpCode.JGT; break;
        case 'JLT': op = OpCode.JLT; break;
        case 'JEQ': op = OpCode.JEQ; break;
        case 'CMP': op = OpCode.CMP; break;
        case 'SCAN': op = OpCode.SCAN; break;
        case 'MOVE': // Alias for SET SPEED
        case 'TURN': // Alias for SET ANGLE
        case 'AIM':  // Alias for SET TURRET
        case 'FIRE': // Alias for SET SHOOT
          // We handle these aliases by converting them to SET instructions or special handling in VM
          // For simplicity in this Compiler, we treat them as SET if they set a register, 
          // but here we will keep them as distinct logical operations mapped to SET in the VM logic or 
          // we can introduce pseudo-ops. 
          // Let's stick to strict OpCodes for the VM, so we rewrite here:
          if (opRaw === 'MOVE') {
             // MOVE 10 -> SET SPEED 10
             program.push({ op: OpCode.SET, args: ['SPEED', args[0]], originalLine: lineNum });
             continue;
          }
          if (opRaw === 'TURN') {
             program.push({ op: OpCode.SET, args: ['ANGLE', args[0]], originalLine: lineNum });
             continue;
          }
          if (opRaw === 'AIM') {
             program.push({ op: OpCode.SET, args: ['TURRET', args[0]], originalLine: lineNum });
             continue;
          }
          if (opRaw === 'FIRE') {
             // FIRE 1 -> SET SHOOT 1
             // FIRE 2 -> SET SHOOT 2
             // Default to 1 if no arg provided
             const fireMode = args[0] || '1';
             program.push({ op: OpCode.SET, args: ['SHOOT', fireMode], originalLine: lineNum });
             continue;
          }
          break;
        default:
          return { program: [], labels: new Map(), error: `Unknown command on line ${lineNum}: ${opRaw}` };
      }

      program.push({ op, args, originalLine: lineNum });
    }

    return { program, labels };
  }
}
