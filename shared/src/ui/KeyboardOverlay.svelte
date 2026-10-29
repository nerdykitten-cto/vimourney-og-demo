<script lang="ts">
  import { untrack } from 'svelte';
  import { capsFor, KEYBOARD_ROWS, type KeyCap } from '../keyboard-layout';

  let {
    lastKey,
    tick,
    allowed = null,
    bad = false,
  }: {
    /** Engine key name of the most recent key press. */
    lastKey: string | null;
    /** Changes on every press so pressing the same key twice lights it twice. */
    tick: number;
    /** Keys the current level allows; others are dimmed. Null means everything is allowed. */
    allowed?: string[] | null;
    /** The last press was refused (a key the level doesn't allow): light it red. */
    bad?: boolean;
  } = $props();

  let lit = $state<Record<string, number>>({});

  $effect(() => {
    if (lastKey === null) return;
    const t = tick;
    const ids = capsFor(lastKey).ids;
    // `lit` is only written here, never a dependency, or clearing it would re-light the keys.
    untrack(() => {
      const next = { ...lit };
      for (const id of ids) next[id] = t;
      lit = next;
    });
    // Not cancelled by the next press: each press only clears the keys it lit, unless re-pressed since.
    setTimeout(() => {
      const copy = { ...lit };
      for (const id of ids) if (copy[id] === t) delete copy[id];
      lit = copy;
    }, 260);
  });

  function usable(cap: KeyCap): boolean {
    if (!allowed) return true;
    if (cap.id === 'Shift' || cap.id === 'Ctrl') return true;
    const names = [cap.base, cap.shift].filter((x): x is string => !!x);
    return names.some((n) => allowed.includes(n)) || allowed.some((a) => a === `Control-${cap.base}`);
  }
</script>

<div class="kb" aria-hidden="true">
  {#each KEYBOARD_ROWS as row, ri (ri)}
    <div class="krow" style:padding-left={ri === 4 ? '5.5rem' : undefined}>
      {#each row as cap, ci (ci)}
        <div class="cap" class:lit={lit[cap.id] !== undefined} class:bad={bad && lit[cap.id] !== undefined} class:off={!usable(cap)} class:home={cap.id === 'f' || cap.id === 'j'} style:flex-grow={cap.w ?? 1} style:flex-basis="{(cap.w ?? 1) * 2.4}rem">
          {#if cap.shift && cap.shift !== cap.base.toUpperCase()}
            <span class="s">{cap.shift}</span>
          {/if}
          <span class="b">{cap.label ?? cap.base}</span>
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .kb {
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
    padding: 0.7rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    user-select: none;
  }
  .krow {
    display: flex;
    gap: 0.28rem;
  }
  .cap {
    position: relative;
    min-width: 0;
    height: 2.6rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-bottom-width: 3px;
    border-radius: 6px;
    font-size: 0.85rem;
    line-height: 1.05;
    transition: background 0.25s var(--ease), box-shadow 0.25s var(--ease), border-color 0.25s var(--ease), transform 0.12s var(--ease);
  }
  .cap .s {
    font-size: 0.62rem;
    color: var(--dim);
  }
  .cap.home::after {
    content: '';
    position: absolute;
    bottom: 3px;
    width: 8px;
    height: 2px;
    border-radius: 1px;
    background: var(--dim);
  }
  .cap.off {
    opacity: 0.32;
  }
  .cap.lit {
    background: color-mix(in srgb, var(--accent) 32%, var(--panel-2));
    border-color: var(--accent);
    box-shadow: var(--glow);
    transform: translateY(2px);
    transition-duration: 0s;
  }
  .cap.lit.bad {
    background: color-mix(in srgb, var(--bad) 35%, var(--panel-2));
    border-color: var(--bad);
    box-shadow: 0 0 12px color-mix(in srgb, var(--bad) 60%, transparent);
  }
</style>
