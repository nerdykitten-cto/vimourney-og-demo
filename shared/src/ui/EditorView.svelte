<script lang="ts">
  import type { EngineState, Pos } from '../engine';
  import { cellFlags } from '../selection';

  let { view, target = null }: { view: EngineState; target?: Pos | null } = $props();

  let probe: HTMLSpanElement | undefined = $state();
  let cw = $state(9);
  let rh = $state(24);

  $effect(() => {
    if (!probe) return;
    const measure = () => {
      const r = probe!.getBoundingClientRect();
      if (r.width > 0) {
        cw = r.width;
        rh = r.height;
      }
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  const insert = $derived(view.mode === 'insert');
  const jump = $derived(view.lastJump);
  const moved = $derived(jump !== null && (jump.from.row !== jump.to.row || Math.abs(jump.from.col - jump.to.col) > 1));
  const trailKey = $derived(view.keyLog.length);

  /** Cells of a line: one per char, plus one for the line break so the cursor can sit past the end. */
  function cells(line: string): string[] {
    return [...line, ' '];
  }
  const cx = (col: number) => (col + 0.5) * cw;
  const cy = (row: number) => (row + 0.5) * rh;
</script>

<div class="editor" role="img" aria-label="Text buffer, line {view.cursor.row + 1} column {view.cursor.col + 1}">
  <span class="probe" bind:this={probe} aria-hidden="true">0</span>
  <div class="gutter" aria-hidden="true">
    {#each view.lines as _, r (r)}
      <div class="num" class:cur={r === view.cursor.row}>{r + 1}</div>
    {/each}
  </div>
  <div class="text">
    {#each view.lines as line, r (r)}
      <div class="row" class:cur={r === view.cursor.row}>
        {#each cells(line) as ch, c (c)}
          {@const f = cellFlags(view, r, c)}
          <span
            class="cell"
            class:cursor={r === view.cursor.row && c === view.cursor.col}
            class:bar={insert}
            class:selected={f.selected}
            class:touched={f.touched}
            class:target={target !== null && target.row === r && target.col === c}
            class:eol={c === line.length}>{ch === ' ' ? ' ' : ch}</span
          >
        {/each}
      </div>
    {/each}
    {#if moved && jump}
      {#key trailKey}
        <svg class="trail" aria-hidden="true" width="100%" height="100%">
          <line x1={cx(jump.from.col)} y1={cy(jump.from.row)} x2={cx(jump.to.col)} y2={cy(jump.to.row)} />
          <circle cx={cx(jump.from.col)} cy={cy(jump.from.row)} r="3.5" />
        </svg>
      {/key}
    {/if}
  </div>
</div>

<style>
  .editor {
    position: relative;
    display: flex;
    gap: 0.9rem;
    padding: 1rem 1.1rem;
    min-height: 9.5rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    font-size: 1.05rem;
    line-height: 1.7;
    overflow-x: auto;
    box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.35);
  }
  .probe {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    line-height: 1.7;
  }
  .gutter {
    color: var(--dim);
    text-align: right;
    user-select: none;
    min-width: 1.6rem;
  }
  .num.cur {
    color: var(--fg);
  }
  .text {
    position: relative;
    flex: 1;
    white-space: pre;
  }
  .row {
    height: 1.7em;
  }
  .cell {
    display: inline-block;
    width: 1ch;
    height: 1.7em;
    vertical-align: top;
    position: relative;
  }
  .cell.selected {
    background: color-mix(in srgb, var(--visual) 35%, transparent);
  }
  .cell.touched {
    animation: flash 0.55s var(--ease);
  }
  @keyframes flash {
    0% {
      background: color-mix(in srgb, var(--warn) 70%, transparent);
      box-shadow: 0 0 14px var(--warn);
    }
    100% {
      background: transparent;
      box-shadow: none;
    }
  }
  .cell.cursor {
    background: var(--normal);
    color: #05080c;
    box-shadow: 0 0 10px color-mix(in srgb, var(--normal) 70%, transparent);
    animation: pulse 1.1s ease-in-out infinite;
  }
  .cell.cursor.bar {
    background: transparent;
    color: inherit;
    box-shadow: none;
  }
  .cell.cursor.bar::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 0.15em;
    bottom: 0.15em;
    width: 2px;
    background: var(--insert);
    box-shadow: 0 0 8px var(--insert);
  }
  @keyframes pulse {
    50% {
      filter: brightness(0.85);
    }
  }
  .cell.target:not(.cursor) {
    outline: 1px dashed var(--accent);
    outline-offset: -1px;
    animation: ping 1.4s ease-in-out infinite;
  }
  @keyframes ping {
    50% {
      outline-color: transparent;
      box-shadow: 0 0 10px var(--accent);
    }
  }
  .trail {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
    animation: fade 0.7s ease-out forwards;
  }
  .trail line {
    stroke: var(--normal);
    stroke-width: 2.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 4px var(--normal));
  }
  .trail circle {
    fill: var(--normal);
  }
  @keyframes fade {
    from {
      opacity: 0.9;
    }
    to {
      opacity: 0;
    }
  }
</style>
