import { createAudio, createSave } from '@kbm/shared';
import { editor } from '@kbm/vim';

/** Shared across screens: one save file, one audio context, the editor being taught. */
export const save = createSave();
export const audio = createAudio(save.data.muted);
export const pkg = editor;

export const sandboxText = [
  'function greet(name) {',
  '  const message = "Hello, " + name + "!";',
  '  return message;',
  '}',
  '',
  'greet("world");',
];
