<script lang="ts">
  import type { EngineState } from '../engine';

  let { view }: { view: EngineState } = $props();

  const ORDER = ['"', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', ...'abcdefghijklmnopqrstuvwxyz'];

  function preview(text: string): string {
    const flat = text.replace(/\n$/, '').replace(/\n/g, '↵');
    return flat.length > 26 ? flat.slice(0, 25) + '…' : flat;
  }

  const rows = $derived(
    ORDER.filter((name) => view.registers[name] !== undefined && view.registers[name]!.text !== '').map((name) => ({
      name,
      reg: view.registers[name]!,
    })),
  );
  const marks = $derived(Object.entries(view.marks));
</script>

<section class="panel" aria-label="Registers and marks">
  <h3>Registers</h3>
  {#each rows as { name, reg } (name)}
    <div class="reg">
      <kbd>{name}</kbd>
      <span class="text">{preview(reg.text)}</span>
      {#if reg.linewise}<span class="tag">line</span>{/if}
    </div>
  {:else}
    <p class="empty">Empty. Yank or delete something.</p>
  {/each}
  {#if marks.length > 0}
    <h3 class="m">Marks</h3>
    {#each marks as [name, pos] (name)}
      <div class="reg"><kbd>{name}</kbd><span class="text">{pos.row + 1}:{pos.col + 1}</span></div>
    {/each}
  {/if}
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 0.7rem 0.9rem 0.9rem;
    min-height: 6rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 600;
  }
  h3.m {
    margin-top: 0.8rem;
  }
  .reg {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.12rem 0;
    font-size: 0.88rem;
  }
  kbd {
    min-width: 1.6rem;
    text-align: center;
    padding: 0.05rem 0.35rem;
    font: inherit;
    border-radius: 5px;
    background: var(--panel-2);
    border: 1px solid var(--line);
    color: var(--warn);
  }
  .text {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tag {
    margin-left: auto;
    font-size: 0.7rem;
    color: var(--dim);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 0.3rem;
  }
  .empty {
    margin: 0;
    color: var(--dim);
    font-size: 0.85rem;
  }
</style>
