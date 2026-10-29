<script lang="ts">
  import type { EngineState } from '../engine';

  let { view }: { view: EngineState } = $props();

  const NAMES: Record<string, string> = {
    normal: 'NORMAL',
    insert: 'INSERT',
    replace: 'REPLACE',
    visual: 'VISUAL',
    'visual-line': 'V-LINE',
    'visual-block': 'V-BLOCK',
  };

  const pendingText = $derived.by(() => {
    const p = view.pending;
    return `${p.register ? `"${p.register}` : ''}${p.count ?? ''}${p.operator ?? ''}${p.awaiting ?? ''}`;
  });
  const tone = $derived(view.mode === 'insert' || view.mode === 'replace' ? 'insert' : view.mode === 'normal' ? 'normal' : 'visual');
</script>

<div class="bar">
  <span class="badge {tone}">{NAMES[view.mode] ?? view.mode}</span>
  <span class="pending" aria-live="polite">{pendingText}{#if pendingText}<span class="caret">▍</span>{/if}</span>
  <span class="pos">{view.cursor.row + 1}:{view.cursor.col + 1}</span>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-top: 0.6rem;
    min-height: 2rem;
  }
  .badge {
    padding: 0.2rem 0.7rem;
    border-radius: 6px;
    font-weight: 700;
    letter-spacing: 0.06em;
    font-size: 0.85rem;
    color: #05080c;
    transition: background 0.18s var(--ease), box-shadow 0.18s var(--ease);
  }
  .badge.normal {
    background: var(--normal);
    box-shadow: 0 0 12px color-mix(in srgb, var(--normal) 55%, transparent);
  }
  .badge.insert {
    background: var(--insert);
    box-shadow: 0 0 12px color-mix(in srgb, var(--insert) 55%, transparent);
  }
  .badge.visual {
    background: var(--visual);
    box-shadow: 0 0 12px color-mix(in srgb, var(--visual) 55%, transparent);
  }
  .pending {
    min-width: 5ch;
    color: var(--warn);
    font-weight: 700;
  }
  .caret {
    animation: blink 1s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  .pos {
    margin-left: auto;
    color: var(--dim);
    font-size: 0.85rem;
  }
</style>
