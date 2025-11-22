
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  
  // Engine Drone Nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  // Initialize Audio Context on first user interaction
  initialize() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.2; // Master volume
    this.masterGain.connect(this.ctx.destination);

    // Generate White Noise Buffer (reused for explosions)
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // --- Engine Rumble Setup ---
    // Continuous low-frequency drone
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'triangle'; // Triangle is smoother/deeper than sawtooth
    this.engineOsc.frequency.value = 60; // Base idle rumble

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0; // Start silent

    // Lowpass filter to make it muddy/mechanical
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
  }

  // Adjusts engine sound based on total movement in the arena
  updateEngine(totalSpeed: number) {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return;
    
    const t = this.ctx.currentTime;
    
    // Normalize speed (e.g., 0 to ~30) to an intensity (0 to 1)
    // Cap at 20 to avoid ear-destroying levels if 10 bots sprint
    const intensity = Math.min(totalSpeed / 20, 1);

    // Volume: 0 if still, up to 0.15 if moving
    const targetVol = intensity * 0.15;

    // Pitch: 60Hz (Idle) -> 100Hz (Revving)
    const targetFreq = 60 + (intensity * 40);

    // Smooth transitions
    this.engineGain.gain.setTargetAtTime(targetVol, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);
  }

  // Silence engine (e.g. on Pause/Stop)
  stopEngine() {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.1);
  }

  // Pew Pew - High pitch sweep
  playShoot() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 0.15);
  }

  // Laser Zap - Sharper, cleaner, instant feel
  playLaser() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine'; // Pure tone
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 0.1);
  }

  // Crunchy Noise with Low Pass Filter
  playExplosion() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start();
    source.stop(t + 0.5);
  }

  // Impact/Hit - Now uses the full explosion sound profile as requested
  playHit() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Match explosion parameters (Deep crunch)
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

    const gain = this.ctx.createGain();
    // Slightly lower volume than death explosion (0.8 vs 1.0), but same deep character
    gain.gain.setValueAtTime(0.8, t); 
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start();
    source.stop(t + 0.5);
  }

  // Low thud
  playCrash() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(30, t + 0.2);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 0.2);
  }
}

export const audio = new SoundManager();
