
import React, { useState, useEffect } from 'react';

export const DocsCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'basics' | 'commands' | 'registers'>('basics');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nbb_docs_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('nbb_docs_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg flex flex-col shadow-lg overflow-hidden transition-all duration-300 ${isCollapsed ? 'shrink-0' : 'flex-1 min-h-0'}`}>
      {/* Header */}
      <div 
        className="bg-slate-900/50 px-4 py-2 border-b border-slate-700 flex justify-between items-center shrink-0 cursor-pointer hover:bg-slate-800 transition-colors group"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
           <svg 
             className={`w-3 h-3 text-slate-500 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} 
             fill="none" 
             viewBox="0 0 24 24" 
             stroke="currentColor"
           >
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
           </svg>
           <h2 className="text-xs font-display font-bold text-slate-300 tracking-wider group-hover:text-white transition-colors">MANUAL</h2>
        </div>
        <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400 transition-colors">
          {isCollapsed ? 'EXPAND' : 'COLLAPSE'}
        </span>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <>
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
                    <div className="bg-slate-900 p-2 rounded border-l-2 border-pink-500">
                      <div className="text-pink-400 font-bold text-[10px]">WEAPON 3: MISSILE</div>
                      <div className="text-slate-500 text-[9px]">Heat: 50 • Dmg: 30 • Ammo: 3</div>
                      <div className="text-slate-500 text-[9px]">
                        SCAN to Lock-on (3s lock). Tracks target.
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-cyan-400 font-bold mb-1">Aiming</h3>
                  <p className="text-slate-400 mb-2">
                    Set <code className="text-pink-400">AIM</code> to rotate the gun. Read <code className="text-orange-400">TURRET</code> to check where it currently is.
                  </p>
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
                      { op: 'SCAN', args: 'deg', d: 'Scan dist. LOCKS ON if found.' },
                    ].map((r, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
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
                    <div className="bg-slate-900 px-2 py-1 rounded"><span className="text-pink-400">AIM x</span> = SET AIM x</div>
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
                        { name: 'AIM', r: '0-360', d: 'Gun Target' },
                        { name: 'SHOOT', r: '0/1', d: '1 = Fire' },
                      ].map((reg, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-800 p-2 rounded text-[10px] hover:bg-slate-700/50 transition-colors">
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
                        { name: 'TURRET', d: 'Actual Gun Angle' },
                        { name: 'RADAR', d: 'Last Scan Dist' },
                        { name: 'HEAT', d: 'Gun Heat' },
                        { name: 'AMMO', d: 'Ammo Count' },
                        { name: 'X', d: 'Position X' },
                        { name: 'Y', d: 'Position Y' },
                        { name: 'HEALTH', d: 'Armor' },
                        { name: 'TIME', d: 'Frame Count' },
                      ].map((reg, i) => (
                        <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 text-[10px] hover:border-slate-600 transition-colors">
                          <span className="text-orange-400 font-bold block">{reg.name}</span>
                          <span className="text-slate-500">{reg.d}</span>
                        </div>
                      ))}
                    </div>
                  </section>
               </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
