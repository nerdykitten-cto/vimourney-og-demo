/** Where on-screen key presses go. Kept free of Phaser so the keypad can load before the game does. */
type Sink = (key: string) => void;

let sink: Sink | null = null;

export function setKeySink(fn: Sink): void {
  sink = fn;
}

export function clearKeySink(fn: Sink): void {
  if (sink === fn) sink = null;
}

export function sendKey(key: string): void {
  sink?.(key);
}
