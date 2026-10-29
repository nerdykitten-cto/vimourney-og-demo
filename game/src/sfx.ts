/** Game sound effects, synthesized with WebAudio so there are no files to ship. */
export interface Sfx {
  readonly muted: boolean;
  setMuted(m: boolean): void;
  key(): void;
  move(): void;
  blocked(): void;
  hit(): void;
  damage(): void;
  pulse(): void;
  jump(): void;
  warn(): void;
  win(): void;
  lose(): void;
  capture(combo: number): void;
  menu(): void;
}

export function createSfx(initialMuted: boolean): Sfx {
  let muted = initialMuted;
  let ctx: AudioContext | null = null;

  const context = (): AudioContext | null => {
    if (muted) return null;
    try {
      if (!ctx) {
        const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  };

  const tone = (freq: number, at: number, dur: number, type: OscillatorType, gain: number, end?: number): void => {
    const c = context();
    if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (end) o.frequency.exponentialRampToValueAtTime(end, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };

  return {
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
    },
    key: () => tone(1500 + Math.random() * 250, 0, 0.025, 'square', 0.02, 800),
    move: () => tone(520, 0, 0.06, 'triangle', 0.05, 760),
    blocked: () => tone(160, 0, 0.1, 'sawtooth', 0.05, 90),
    hit: () => {
      tone(700, 0, 0.09, 'square', 0.07, 1400);
      tone(1400, 0.06, 0.12, 'triangle', 0.06, 2100);
    },
    damage: () => {
      tone(140, 0, 0.25, 'sawtooth', 0.12, 50);
      tone(90, 0.02, 0.3, 'square', 0.08, 40);
    },
    pulse: () => tone(220, 0, 0.12, 'square', 0.05, 330),
    jump: () => tone(900, 0, 0.05, 'triangle', 0.04, 450),
    warn: () => tone(660, 0, 0.07, 'square', 0.035, 660),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25, 'triangle', 0.08)),
    lose: () => [330, 262, 196, 131].forEach((f, i) => tone(f, i * 0.14, 0.3, 'sawtooth', 0.07)),
    capture: (combo) => tone(600 + Math.min(combo, 10) * 80, 0, 0.1, 'triangle', 0.07, 900 + Math.min(combo, 10) * 100),
    menu: () => tone(880, 0, 0.04, 'triangle', 0.04),
  };
}
