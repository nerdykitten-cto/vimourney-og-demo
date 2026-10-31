import { createVimEngine } from '@kbm/vim';
import { AREAS, areaById } from './sim/area2';
import { ENEMIES } from './sim/battle';
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

const navs = new Map<string, MapNav>();
const defeatedKey = (areaId: string): string => (areaId === 'area-1' ? 'defeated' : `defeated-${areaId}`);

/** An area's map, rebuilt from the saved list of defeated enemies the first time it is needed. */
export function getNav(areaId = 'area-1'): MapNav {
  let nav = navs.get(areaId);
  if (!nav) {
    nav = new MapNav(createVimEngine(), areaById(areaId));
    for (const id of store.get<string[]>(defeatedKey(areaId), [])) nav.defeat(id);
    navs.set(areaId, nav);
  }
  return nav;
}

export function markDefeated(areaId: string, id: string): void {
  const list = store.get<string[]>(defeatedKey(areaId), []);
  if (!list.includes(id)) store.set(defeatedKey(areaId), [...list, id]);
}

export function markCleared(areaId: string): void {
  store.set(`cleared-${areaId}`, true);
}

export function isCleared(areaId: string): boolean {
  return store.get<boolean>(`cleared-${areaId}`, false);
}

export function resetProgress(): void {
  navs.clear();
  for (const a of AREAS) {
    store.set(defeatedKey(a.id), []);
    store.set(`cleared-${a.id}`, false);
    store.set(`seen-${a.id}`, false);
  }
  // The tutorial and enemy cards come back too, so a demo machine can be handed to the next player.
  store.set('coached', false);
  store.set('fought', false);
  for (const id of Object.keys(ENEMIES)) store.set(`seen-${id}`, false);
  mastery.reset();
}

export function setMuted(m: boolean): void {
  sfx.setMuted(m);
  store.set('muted', m);
}

log.add('session-start', { viewport: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio, lang: navigator.language });
