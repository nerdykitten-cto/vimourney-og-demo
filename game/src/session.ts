import { createVimEngine } from '@kbm/vim';
import { area1 } from './sim/area1';
import { PlaytestLog } from './sim/log';
import { MapNav } from './sim/map';
import { Mastery } from './sim/mastery';
import { createStore } from './sim/storage';
import { createSfx } from './sfx';

/** Everything that outlives a scene: save data, mastery, the map, sound. */
export const store = createStore();
export const mastery = new Mastery(store);
export const log = new PlaytestLog(store);
export const sfx = createSfx(store.get<boolean>('muted', false));

let nav: MapNav | null = null;

/** The area map, rebuilt from the saved list of defeated enemies the first time it is needed. */
export function getNav(): MapNav {
  if (!nav) {
    nav = new MapNav(createVimEngine(), area1);
    for (const id of store.get<string[]>('defeated', [])) nav.defeat(id);
  }
  return nav;
}

export function markDefeated(id: string): void {
  const list = store.get<string[]>('defeated', []);
  if (!list.includes(id)) store.set('defeated', [...list, id]);
}

export function resetProgress(): void {
  nav = null;
  store.set('defeated', []);
  mastery.reset();
}

export function setMuted(m: boolean): void {
  sfx.setMuted(m);
  store.set('muted', m);
}
