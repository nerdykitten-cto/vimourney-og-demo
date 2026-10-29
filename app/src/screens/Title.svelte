<script lang="ts">
  let { onPlay }: { onPlay: () => void } = $props();
</script>

<main class="title">
  <h1>Keyboard Mastery</h1>
  <p class="sub">Learn to code at the speed of thought.</p>

  <div class="cards">
    <section class="card ready">
      <h2>Vim</h2>
      <p>Modes, motions, operators, text objects.</p>
      <button type="button" class="primary" onclick={onPlay}>Play</button>
    </section>
    <section class="card soon">
      <h2>Emacs</h2>
      <p>Coming soon</p>
    </section>
    <section class="card soon">
      <h2>NeoVim</h2>
      <p>Coming soon</p>
    </section>
  </div>
</main>

<style>
  .title {
    min-height: 100vh;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.4rem;
    padding: 2rem 1rem;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: clamp(2rem, 6vw, 3.4rem);
    color: var(--accent);
    text-shadow: var(--glow);
    letter-spacing: 0.02em;
  }
  .sub {
    margin: 0 0 2rem;
    color: var(--dim);
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
  }
  .card {
    width: 17rem;
    padding: 1.2rem;
    text-align: left;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .card h2 {
    margin: 0 0 0.3rem;
    font-size: 1.2rem;
  }
  .card p {
    margin: 0 0 1rem;
    color: var(--dim);
  }
  .card.ready {
    border-color: var(--accent);
    box-shadow: var(--glow);
  }
  .card.soon {
    opacity: 0.5;
  }
  .card.soon p {
    margin: 0;
  }
  button {
    width: 100%;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  button:hover {
    border-color: var(--accent);
  }
  button.primary {
    background: color-mix(in srgb, var(--accent) 18%, var(--panel-2));
    border-color: var(--accent);
  }
</style>
