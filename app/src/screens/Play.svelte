<script lang="ts">
  import { computeReplay, keyName, nextLevel, Session, starsFor, type EngineState, type Level, type World } from '@kbm/shared';
  import EditorView from '@kbm/shared/ui/EditorView.svelte';
  import FocusGate from '@kbm/shared/ui/FocusGate.svelte';
  import HintPanel from '@kbm/shared/ui/HintPanel.svelte';
  import Hud from '@kbm/shared/ui/Hud.svelte';
  import IntroCard from '@kbm/shared/ui/IntroCard.svelte';
  import KeyHistory from '@kbm/shared/ui/KeyHistory.svelte';
  import KeyboardOverlay from '@kbm/shared/ui/KeyboardOverlay.svelte';
  import ModeBadge from '@kbm/shared/ui/ModeBadge.svelte';
  import RegisterPanel from '@kbm/shared/ui/RegisterPanel.svelte';
  import { audio, pkg, sandboxText, save } from '../game';

  let { level = null, onMap, onLevel }: { level?: Level | null; onMap: () => void; onLevel: (id: string) => void } = $props();

  type Phase = 'intro' | 'play' | 'result' | 'replay';

  // `level` never changes during a visit: App re-creates this screen with {#key}.
  // svelte-ignore state_referenced_locally
  const lv = level;
  const card = lv?.introCard ? pkg.cards[lv.introCard] : undefined;
  const session = new Session(pkg.createEngine(), lv);
  if (!lv) session.load(sandboxText);

  let phase = $state<Phase>(lv?.introCard && card && !save.hasSeenCard(lv.introCard) ? 'intro' : 'play');
  let st = $state<EngineState>(session.engine.state);
  let lastKey = $state<string | null>(null);
  let lastBlocked = $state(false);
  let tick = $state(0);
  let keystrokes = $state(0);
  let muted = $state(audio.muted);
  let toast = $state('');
  let shake = $state(0);
  let hintStep = $state(0);
  let result = $state<{ stars: number; keystrokes: number; best: boolean; next: { world: World; level: Level } | null; newWorld: boolean } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let replayTimer: ReturnType<typeof setInterval> | undefined;
  let replayEnd: ReturnType<typeof setTimeout> | undefined;
  let replayIdx = $state(0);

  /** Keys shown as usable on the keyboard: while typing text or answering f/t/r, everything is. */
  const overlayKeys = $derived.by(() => {
    if (!lv) return null;
    if (lv.typing && st.mode === 'insert') return null;
    if (st.pending.awaiting && ['f', 'F', 't', 'T', 'r'].includes(st.pending.awaiting)) return null;
    return lv.allowedKeys;
  });

  $effect(() => () => {
    clearTimeout(toastTimer);
    clearInterval(replayTimer);
    clearTimeout(replayEnd);
  });

  function dismissIntro(): void {
    if (lv?.introCard) save.markCardSeen(lv.introCard);
    phase = 'play';
  }

  function onKey(key: string): void {
    if (phase === 'intro') {
      if (key === 'Enter') dismissIntro();
      return;
    }
    if (phase === 'replay') {
      stopReplay();
      return;
    }
    if (phase === 'result') {
      if (key === 'Enter') result?.next ? onLevel(result.next.level.id) : onMap();
      else if (key === 'r') restart();
      else if (key === 'Escape') onMap();
      return;
    }
    lastKey = key;
    tick++;
    const res = session.feed(key);
    lastBlocked = res.kind === 'blocked';
    if (res.kind === 'blocked') {
      audio.blocked();
      shake++;
      toast = `${keyName(key)} isn't unlocked for this level`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = ''), 1800);
      return;
    }
    audio.click();
    st = res.state;
    keystrokes = session.keystrokes;
    if (res.solved && lv) finish(lv);
  }

  function finish(l: Level): void {
    const used = session.solvedAt ?? session.keystrokes;
    const stars = starsFor(used, l.par);
    const prev = save.data.levels[l.id];
    const best = !prev || stars > prev.stars || used < prev.best;
    const hadNext = nextLevel(pkg.worlds, l.id, save);
    save.record(l.id, used, stars);
    const next = nextLevel(pkg.worlds, l.id, save);
    audio.success(stars);
    result = { stars, keystrokes: used, best, next, newWorld: !hadNext && next !== null };
    phase = 'result';
  }

  function restart(): void {
    clearInterval(replayTimer);
    clearTimeout(replayEnd);
    session.restart();
    if (!lv) session.load(sandboxText);
    st = session.engine.state;
    keystrokes = 0;
    result = null;
    lastKey = null;
    lastBlocked = false;
    toast = '';
    phase = card && lv?.introCard && !save.hasSeenCard(lv.introCard) ? 'intro' : 'play';
  }

  function startReplay(): void {
    if (!lv) return;
    const states = computeReplay(pkg.createEngine, { lines: lv.start.lines, cursor: lv.start.cursor }, lv.parSolution);
    clearInterval(replayTimer);
    clearTimeout(replayEnd);
    phase = 'replay';
    replayIdx = 0;
    st = states[0]!;
    lastKey = null;
    lastBlocked = false;
    replayTimer = setInterval(() => {
      replayIdx++;
      if (replayIdx >= states.length) {
        clearInterval(replayTimer);
        replayEnd = setTimeout(stopReplay, 1600);
        return;
      }
      st = states[replayIdx]!;
      lastKey = lv.parSolution[replayIdx - 1] ?? null;
      tick++;
      audio.click();
    }, 600);
  }

  function stopReplay(): void {
    clearInterval(replayTimer);
    clearTimeout(replayEnd);
    restart();
  }

  function toggleMute(): void {
    muted = !muted;
    audio.setMuted(muted);
    save.setMuted(muted);
  }
</script>

<main class="play">
  <nav>
    <button type="button" onclick={onMap}>← Map</button>
    <span class="grow"></span>
    <button type="button" onclick={restart} title="Alt+R">↻ Restart</button>
    <button type="button" onclick={toggleMute} aria-pressed={muted}>{muted ? '🔇 Muted' : '🔊 Sound'}</button>
  </nav>

  <FocusGate {onKey} onRestart={restart}>
    {#if lv}
      <Hud title={lv.title} brief={lv.brief} {keystrokes} par={lv.par} solved={phase === 'result'} />
    {:else}
      <header class="free">
        <h2>Sandbox</h2>
        <p>Free play. Every key works. Try <code>dw</code>, <code>ci"</code>, <code>vip</code>, <code>yyp</code>, <code>u</code>.</p>
      </header>
    {/if}

    {#if phase === 'replay'}
      <p class="replay" role="status">▶ Par solution — press any key to stop</p>
    {/if}

    <div class="layout">
      <div class="main">
        {#key shake}
          <div class="wrap" class:shake={shake > 0}>
            <EditorView view={st} target={lv?.goal.cursor ?? null} />
          </div>
        {/key}
        <ModeBadge view={st} />
        <div class="toast" role="status">{toast}</div>
      </div>
      <aside>
        <KeyHistory view={st} />
        <RegisterPanel view={st} />
        {#if lv && (phase === 'play' || phase === 'replay')}
          <HintPanel hints={lv.hints} step={hintStep} onNext={() => hintStep++} onReplay={startReplay} />
        {/if}
      </aside>
    </div>

    <KeyboardOverlay {lastKey} {tick} bad={lastBlocked} allowed={overlayKeys} />

    {#if phase === 'intro' && card}
      <div class="overlay">
        <IntroCard title={card.title} keys={card.keys} body={card.body} demo={card.demo} createEngine={pkg.createEngine} onStart={dismissIntro} />
      </div>
    {/if}

    {#if phase === 'result' && result && lv}
      <div class="overlay" role="dialog" aria-label="Level clear">
        <div class="result">
          <h3>Level clear</h3>
          <div class="stars">{#each [1, 2, 3] as s (s)}<span class:on={s <= result.stars}>★</span>{/each}</div>
          <p>{result.keystrokes} keystrokes · par {lv.par}{#if result.best}<b class="best">&nbsp;· new best</b>{/if}</p>
          {#if result.stars < 3}
            <p class="dim">Par is {lv.par}. Retry, and use the hint button to watch the par solution.</p>
          {/if}
          {#if result.newWorld && result.next}
            <p class="unlock">🔓 World unlocked: {result.next.world.title}</p>
          {/if}
          <div class="actions">
            <button type="button" onclick={restart}>Retry <kbd>r</kbd></button>
            <button type="button" onclick={onMap}>Map <kbd>Esc</kbd></button>
            <button type="button" class="primary" onclick={() => (result?.next ? onLevel(result.next.level.id) : onMap())}>
              {result.next ? `Next: ${result.next.level.title}` : 'Done'} <kbd>⏎</kbd>
            </button>
          </div>
        </div>
      </div>
    {/if}
  </FocusGate>
</main>

<style>
  .play {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem 16px 2rem;
  }
  nav {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .grow {
    flex: 1;
  }
  nav button {
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--dim);
  }
  nav button:hover {
    color: var(--fg);
    border-color: var(--accent);
  }
  .free h2 {
    margin: 0 0 0.25rem;
    color: var(--accent);
  }
  .free p {
    margin: 0 0 0.9rem;
  }
  code {
    padding: 0 0.3rem;
    background: var(--panel-2);
    border-radius: 4px;
    color: var(--warn);
  }
  .replay {
    margin: 0 0 0.6rem;
    padding: 0.35rem 0.8rem;
    border-left: 3px solid var(--visual);
    background: var(--panel);
    border-radius: 0 8px 8px 0;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 19rem;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  aside {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }
  .toast {
    min-height: 1.4rem;
    margin-top: 0.4rem;
    color: var(--bad);
    font-size: 0.9rem;
  }
  .shake {
    animation: shake 0.28s linear;
  }
  @keyframes shake {
    20% {
      transform: translateX(-6px);
    }
    40% {
      transform: translateX(6px);
    }
    60% {
      transform: translateX(-4px);
    }
    80% {
      transform: translateX(3px);
    }
  }
  .overlay {
    position: absolute;
    inset: -0.5rem;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--bg) 84%, transparent);
    backdrop-filter: blur(4px);
    border-radius: 14px;
  }
  .result {
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    text-align: center;
  }
  .result h3 {
    margin: 0;
    font-size: 1.8rem;
    color: var(--accent);
    text-shadow: var(--glow);
  }
  .result p {
    margin: 0;
  }
  .dim {
    color: var(--dim);
    font-size: 0.9rem;
  }
  .best {
    color: var(--star);
  }
  .unlock {
    color: var(--accent);
    font-weight: 700;
    margin-top: 0.3rem;
  }
  .stars {
    font-size: 2.4rem;
    letter-spacing: 0.2em;
    color: var(--line);
  }
  .stars .on {
    color: var(--star);
    text-shadow: 0 0 14px var(--star);
    animation: pop 0.5s var(--ease) backwards;
  }
  .stars .on:nth-child(2) {
    animation-delay: 0.12s;
  }
  .stars .on:nth-child(3) {
    animation-delay: 0.24s;
  }
  @keyframes pop {
    from {
      transform: scale(0);
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.8rem;
  }
  .actions button {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .actions button:hover {
    border-color: var(--accent);
  }
  .actions .primary {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--panel-2));
  }
  kbd {
    padding: 0 0.35rem;
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--dim);
  }
  @media (max-width: 820px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
