
import React, { useState } from 'react';

export const DocsCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'basics' | 'commands' | 'registers'>('basics');

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg flex flex-col shadow-lg overflow-hidden flex-1 min-h-0">
      {/* Header */}
      <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-700 flex justify-between items-center shrink-0">
        <h2 className="text-xs font-display font-bold text-slate-300 tracking-wider">MANUAL</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-900/30 shrink-0">
        {[
          { id: 'basics', label: 'BASICS' },
          { id: 'commands', label: 'CMDS' },
          { id: 'registers', label: 'REGS' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 text-[10px] font-mono font-bold transition-colors ${
              activeTab === tab.id 
                ? 'bg-slate-700/50 text-cyan-400 border-b-2 border-cyan-400' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 text-slate-300 font-mono text-xs leading-relaxed flex-1 overflow-y-auto custom-scrollbar bg-slate-900/20 min-h-0">
        
        {/* BASICS TAB */}
        {activeTab === 'basics' && (
          <div className="space-y-4">
            <section>
              <h3 className="text-cyan-400 font-bold mb-1">Game Engine</h3>
              <p className="text-slate-400">
                Code runs at <span className="text-white">60 FPS</span>. CPU executes <span className="text-white">5 instructions</span> per frame.
              </p>
            </section>

            <section>
              <h3 className="text-cyan-400 font-bold mb-1">Weapons</h3>
              <p className="text-slate-400 mb-2">
                To fire, first select a weapon with <code className="text-pink-400">SET WEAPON x</code>, then trigger it with <code className="text-pink-400">FIRE 1</code>.
              </p>
              <div className="grid grid-cols-1 gap-2 mt-1">
                <div className="bg-slate-900 p-2 rounded border-l-2 border-yellow-500">
                  <div className="text-yellow-400 font-bold text-[10px]">WEAPON 1: PROJECTILE</div>
                  <div className="text-slate-500 text-[9px]">Heat: 20 • Dmg: 10 • Ammo: 50</div>
                  <div className="text-slate-500 text-[9px]">Standard slug. Limited ammo.</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border-l-2 border-cyan-500">
                  <div className="text-cyan-400 font-bold text-[10px]">WEAPON 2: LASER</div>
                  <div className="text-slate-500 text-[9px]">Heat: 40 • Dmg: 8 • Ammo: ∞</div>
                  <div className="text-slate-500 text-[9px]">Instant Hitscan. High Heat cost.</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-cyan-400 font-bold mb-1">Heat System</h3>
              <p className="text-slate-400 mb-2">
                Max heat is <span className="text-red-400">100</span>.
              </p>
              <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-1">
                <li>Heat decays at 1 per frame.</li>
                <li>If Heat >= 100, gun <span className="text-red-500 font-bold">JAMS</span>.</li>
                <li>You cannot fire until Heat drops back to 0.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-cyan-400 font-bold mb-1">Compare & Jump</h3>
              <p className="text-slate-400 mb-2">
                Conditional jumps depend on the last <code className="text-cyan-400">CMP</code> instruction.
              </p>
              <div className="bg-slate-950 p-2 rounded border-l-2 border-cyan-500">
                <pre className="text-[10px] opacity-70">
CMP radar 0    ; Sets internal flags
JGT ATTACK     ; Jumps ONLY if radar > 0
JEQ PATROL     ; Jumps ONLY if radar == 0
                </pre>
              </div>
            </section>
          </div>
        )}

        {/* COMMANDS TAB */}
        {activeTab === 'commands' && (
          <div className="space-y-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 text-[10px]">
                  <th className="py-1">OP</th>
                  <th className="py-1">ARGS</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {[
                  { op: 'SET', args: 'reg val', d: 'Assign value' },
                  { op: 'ADD', args: 'reg val', d: 'Add to reg' },
                  { op: 'SUB', args: 'reg val', d: 'Sub from reg' },
                  { op: 'MUL', args: 'reg val', d: 'Multiply' },
                  { op: 'DIV', args: 'reg val', d: 'Divide' },
                  { op: 'CMP', args: 'a b', d: 'Compare a to b' },
                  { op: 'JMP', args: 'lbl', d: 'Jump to lbl' },
                  { op: 'JGT', args: 'lbl', d: 'Jump if a > b' },
                  { op: 'JLT', args: 'lbl', d: 'Jump if a < b' },
                  { op: 'JEQ', args: 'lbl', d: 'Jump if a == b' },
                  { op: 'SCAN', args: 'deg', d: 'Scan dist -> RADAR' },
                ].map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-1.5 text-cyan-400 font-bold">{r.op}</td>
                    <td className="py-1.5">
                      <div className="text-purple-300">{r.args}</div>
                      <div className="text-slate-500 text-[9px]">{r.d}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div>
              <div className="text-[10px] font-bold text-slate-400 mb-1">ALIASES (Shortcuts)</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-slate-900 px-2 py-1 rounded"><span className="text-pink-400">MOVE x</span> = SET SPEED x</div>
                <div className="bg-slate-900 px-2 py-1 rounded"><span className="text-pink-400">TURN x</span> = SET ANGLE x</div>
                <div className="bg-slate-900 px-2 py-1 rounded"><span className="text-pink-400">AIM x</span> = SET TURRET x</div>
                <div className="bg-slate-900 px-2 py-1 rounded"><span className="text-pink-400">FIRE 1</span> = SET SHOOT 1</div>
              </div>
            </div>
          </div>
        )}

        {/* REGISTERS TAB */}
        {activeTab === 'registers' && (
           <div className="space-y-4">
              <section>
                <div className="text-[10px] font-bold text-slate-400 mb-2">CONTROLS (Write)</div>
                <div className="space-y-1">
                  {[
                    { name: 'SPEED', r: '0-10', d: 'Engine power' },
                    { name: 'ANGLE', r: '0-360', d: 'Body Direction' },
                    { name: 'TURRET', r: '0-360', d: 'Gun Direction' },
                    { name: 'WEAPON', r: '1-2', d: '1=Slug, 2=Laser' },
                    { name: 'SHOOT', r: '0/1', d: '1 = Fire Active Weapon' },
                  ].map((reg, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-800 p-2 rounded text-[10px]">
                      <div>
                        <span className="text-pink-400 font-bold mr-2">{reg.name}</span>
                        <span className="text-slate-500">({reg.r})</span>
                      </div>
                      <div className="text-slate-400">{reg.d}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="text-[10px] font-bold text-slate-400 mb-2">SENSORS (Read Only)</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'RADAR', d: 'Last Scan Dist' },
                    { name: 'AMMO', d: 'Ammo for active weapon' },
                    { name: 'HEAT', d: 'Gun Heat 0-100' },
                    { name: 'X', d: 'Position X' },
                    { name: 'Y', d: 'Position Y' },
                    { name: 'HEALTH', d: 'Armor' },
                    { name: 'TIME', d: 'Frame Count' },
                  ].map((reg, i) => (
                    <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 text-[10px]">
                      <span className="text-orange-400 font-bold block">{reg.name}</span>
                      <span className="text-slate-500">{reg.d}</span>
                    </div>
                  ))}
                </div>
              </section>
           </div>
        )}
      </div>
    </div>
  );
};
