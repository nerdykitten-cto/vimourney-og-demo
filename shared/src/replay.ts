import type { EngineFactory, EngineInit, EngineState } from './engine';

/** Every state of a scripted run: index 0 is the start, index i is after the i-th key. */
export function computeReplay(factory: EngineFactory, start: EngineInit, keys: readonly string[]): EngineState[] {
  const engine = factory();
  engine.reset(start);
  const states = [engine.state];
  for (const k of keys) states.push(engine.feed(k));
  return states;
}
