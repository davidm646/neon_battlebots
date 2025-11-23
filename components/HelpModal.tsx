
import React, { useState } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'basics' | 'commands' | 'registers'>('basics');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-lg w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl shadow-cyan-900/20">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-display font-bold text-white">NEON BATTLEBOTS MANUAL</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6">
          {[
            { id: 'basics', label: 'Basics' },
            { id: 'commands', label: 'Commands' },
            { id: 'registers', label: 'Registers' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-mono font-bold border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-cyan-500 text-cyan-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-300 font-mono text-sm leading-relaxed custom-scrollbar">
          
          {/* BASICS TAB */}
          {activeTab === 'basics' && (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg text-white font-bold mb-2">How it Works</h3>
                <p>
                  You control a bot in a real-time arena. The code runs on a virtual CPU that executes 
                  <span className="text-cyan-400"> 5 instructions per frame</span> (60 FPS).
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li>Code is case-insensitive.</li>
                  <li>Empty lines and comments (<span className="text-green-400">; comment</span>) are ignored.</li>
                  <li>Labels end with a colon (e.g., <span className="text-yellow-400">LOOP:</span>).</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg text-white font-bold mb-2">Aiming vs Firing</h3>
                <div className="bg-slate-800 p-3 rounded border border-slate-700">
                  <p className="mb-2 text-xs">
                    The turret is <strong>not instantaneous</strong>. It rotates at a fixed speed.
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-400">
                    <li>Use <code className="text-pink-400">AIM x</code> (or <code className="text-cyan-400">SET AIM x</code>) to set the <strong>Target Angle</strong>.</li>
                    <li>Read <code className="text-orange-400">TURRET</code> to get the <strong>Actual Angle</strong>.</li>
                    <li>Compare them before firing to ensure you hit your target!</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-lg text-white font-bold mb-2">Variables vs Registers</h3>
                <p className="mb-2">
                  There are two types of storage:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="text-cyan-400 font-bold mb-1">System Registers</div>
                    <p className="text-xs">Hardcoded names that control the robot or read sensor data. Example: <code className="bg-slate-900 px-1 text-pink-400">SPEED</code>, <code className="bg-slate-900 px-1 text-pink-400">RADAR</code>.</p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="text-purple-400 font-bold mb-1">Variables</div>
                    <p className="text-xs">Any other word (e.g., <code className="bg-slate-900 px-1 text-purple-300">A</code>, <code className="bg-slate-900 px-1 text-purple-300">myVar</code>, <code className="bg-slate-900 px-1 text-purple-300">target</code>) is automatically created as a variable initialized to 0.</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* COMMANDS TAB */}
          {activeTab === 'commands' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg text-white font-bold mb-4">Instruction Set</h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-xs uppercase">
                      <th className="py-2">Opcode</th>
                      <th className="py-2">Arguments</th>
                      <th className="py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs md:text-sm">
                    {[
                      { op: 'SET', args: 'reg, val', desc: 'Sets register/var to value.' },
                      { op: 'ADD', args: 'reg, val', desc: 'Adds value to register.' },
                      { op: 'SUB', args: 'reg, val', desc: 'Subtracts value from register.' },
                      { op: 'MUL', args: 'reg, val', desc: 'Multiplies register by value.' },
                      { op: 'DIV', args: 'reg, val', desc: 'Divides register by value.' },
                      { op: 'CMP', args: 'reg, val', desc: 'Compares reg with val. Sets flags for JMP.' },
                      { op: 'JMP', args: 'label', desc: 'Unconditional jump to label.' },
                      { op: 'JLT', args: 'label', desc: 'Jump if last CMP was Less Than.' },
                      { op: 'JGT', args: 'label', desc: 'Jump if last CMP was Greater Than.' },
                      { op: 'JEQ', args: 'label', desc: 'Jump if last CMP was Equal.' },
                      { op: 'SCAN', args: 'angle', desc: 'Scans at angle. Puts distance in RADAR. (-1 if none)' },
                      { op: 'NOOP', args: '-', desc: 'No Operation. Waits 1 cycle.' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 font-bold text-cyan-400">{row.op}</td>
                        <td className="py-2 text-purple-300">{row.args}</td>
                        <td className="py-2 text-slate-400">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-lg text-white font-bold mb-4">Convenience Aliases</h3>
                <p className="text-xs text-slate-400 mb-2">These commands are shorthand for setting specific system registers.</p>
                <table className="w-full text-left border-collapse">
                   <tbody className="text-xs md:text-sm">
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2 font-bold text-pink-400">MOVE x</td>
                      <td className="py-2 text-slate-400">Same as <code className="text-cyan-400">SET SPEED x</code></td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2 font-bold text-pink-400">TURN x</td>
                      <td className="py-2 text-slate-400">Same as <code className="text-cyan-400">SET ANGLE x</code> (Body angle)</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2 font-bold text-pink-400">AIM x</td>
                      <td className="py-2 text-slate-400">Same as <code className="text-cyan-400">SET AIM x</code> (Target Gun Angle)</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2 font-bold text-pink-400">FIRE 1</td>
                      <td className="py-2 text-slate-400">Same as <code className="text-cyan-400">SET SHOOT 1</code></td>
                    </tr>
                   </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REGISTERS TAB */}
          {activeTab === 'registers' && (
             <div className="space-y-6">
                <section>
                  <h3 className="text-lg text-white font-bold mb-4">System Registers (Read/Write)</h3>
                  <div className="grid gap-3">
                    {[
                      { name: 'SPEED', range: '0-10', desc: 'Controls movement speed.' },
                      { name: 'ANGLE', range: '0-360', desc: 'Direction of movement/body.' },
                      { name: 'AIM', range: '0-360', desc: 'Target angle for the Turret.' },
                      { name: 'SHOOT', range: '0 or 1', desc: 'Set to 1 to fire. Auto-resets to 0 next frame.' },
                    ].map((reg, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800 p-3 rounded">
                        <div>
                          <span className="text-pink-400 font-bold mr-2">{reg.name}</span>
                          <span className="text-xs text-slate-500 border border-slate-600 px-1 rounded">{reg.range}</span>
                        </div>
                        <div className="text-sm text-slate-300">{reg.desc}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-lg text-white font-bold mb-4">Sensors (Read Only)</h3>
                  <div className="grid gap-3">
                    {[
                      { name: 'TURRET', desc: 'Actual physical angle of the gun.' },
                      { name: 'RADAR', desc: 'Distance to nearest object found by SCAN.' },
                      { name: 'X', desc: 'Current X coordinate of bot (0-800).' },
                      { name: 'Y', desc: 'Current Y coordinate of bot (0-600).' },
                      { name: 'HEALTH', desc: 'Current health (0-100).' },
                      { name: 'HEAT', desc: 'Current weapon heat (0-100).' },
                    ].map((reg, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 border border-slate-700 p-3 rounded">
                        <span className="text-orange-400 font-bold">{reg.name}</span>
                        <div className="text-sm text-slate-400">{reg.desc}</div>
                      </div>
                    ))}
                  </div>
                </section>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};
