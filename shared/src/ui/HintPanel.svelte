<script lang="ts">
  let {
    hints,
    step,
    onNext,
    onReplay,
  }: {
    hints: { nudge: string; command: string };
    /** How many hints are revealed: 0 none, 1 nudge, 2 command, 3 replay offered. */
    step: number;
    onNext: () => void;
    onReplay: () => void;
  } = $props();
</script>

<section class="hint" aria-label="Hints">
  {#if step >= 1}<p><b>Nudge</b> {hints.nudge}</p>{/if}
  {#if step >= 2}<p><b>Command</b> {hints.command}</p>{/if}
  <div class="actions">
    {#if step < 3}
      <button type="button" onclick={onNext}>{step === 0 ? 'Need a hint?' : 'More help'}</button>
    {:else}
      <button type="button" onclick={onReplay}>▶ Watch the par solution</button>
    {/if}
  </div>
</section>

<style>
  .hint {
    display: grid;
    gap: 0.4rem;
    font-size: 0.9rem;
  }
  p {
    margin: 0;
    padding: 0.5rem 0.7rem;
    background: var(--panel);
    border-left: 3px solid var(--warn);
    border-radius: 0 8px 8px 0;
  }
  b {
    color: var(--warn);
    margin-right: 0.4rem;
    font-weight: 600;
  }
  button {
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--dim);
  }
  button:hover {
    color: var(--fg);
    border-color: var(--warn);
  }
</style>
