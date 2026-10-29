import type { Engine, EngineFactory, Pos } from './engine';
import type { Level } from './level';

/** A group of levels with a theme. Worlds unlock in order. */
export interface World {
  id: string;
  title: string;
  /** One or two lines of framing shown on the map. */
  flavor: string;
  levels: Level[];
}

/** The "new command" card shown the first time a level uses a command. */
export interface IntroCardDef {
  title: string;
  /** Keys to show as keycaps (engine key names). */
  keys: string[];
  body: string;
  /** A tiny scripted run, replayed on a loop beside the text. */
  demo?: { lines: string[]; cursor?: Pos; keys: string[] };
}

/** Everything the shell needs to host one editor (Vim now, Emacs and NeoVim later). */
export interface EditorPackage {
  id: string;
  name: string;
  available: boolean;
  createEngine: EngineFactory;
  worlds: World[];
  cards: Record<string, IntroCardDef>;
}

export type { Engine };
