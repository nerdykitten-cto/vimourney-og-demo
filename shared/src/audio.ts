/** Synthesized sound effects (WebAudio), so the game ships no audio files. */
export interface GameAudio {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** A key was accepted. */
  click(): void;
  /** A key the level does not allow. */
  blocked(): void;
  /** The level was solved; `stars` 1-3 decides how long the jingle is. */
  success(stars: number): void;
}

type Ctx = AudioContext;

export function createAudio(initialMuted = false): GameAudio {
  let muted = initialMuted;
  let ctx: Ctx | null = null;

  function context(): Ctx | null {
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
  }

  function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, endFreq?: number): void {
    const c = context();
    if (!c) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
    },
    click() {
      // A short, slightly randomised tick so fast typing doesn't sound like a machine gun.
      tone(1400 + Math.random() * 300, 0, 0.03, 'square', 0.025, 700);
    },
    blocked() {
      tone(170, 0, 0.12, 'sawtooth', 0.05, 90);
    },
    success(stars) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const n = Math.min(4, 1 + stars);
      for (let i = 0; i < n; i++) tone(notes[i]!, i * 0.09, 0.22, 'triangle', 0.07);
    },
  };
}
