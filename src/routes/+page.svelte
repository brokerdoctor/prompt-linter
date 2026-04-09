<script lang="ts">
  import { compile, type CompilePass } from '$lib/compiler.js';
  import { lint, type LintReport } from '$lib/linter.js';

  // ── state ──────────────────────────────────────────────────────────────────
  let promptText = $state('');
  let apiKey = $state('');
  let passes = $state<CompilePass[]>([]);
  let running = $state(false);
  let compiled = $state<boolean | null>(null);
  let activePass = $state(0);
  let liveReport = $state<LintReport | null>(null);

  // ── derived ────────────────────────────────────────────────────────────────
  const currentPass = $derived(passes[activePass] ?? null);
  const hasReport = $derived(liveReport !== null || passes.length > 0);

  // ── actions ────────────────────────────────────────────────────────────────
  function runStaticLint() {
    if (!promptText.trim()) return;
    const report = lint(promptText);
    liveReport = report;
    passes = [];
    compiled = null;
    activePass = 0;
  }

  async function runCompiler() {
    if (!promptText.trim() || !apiKey.trim()) return;
    running = true;
    compiled = null;
    passes = [];
    liveReport = null;
    activePass = 0;

    try {
      const result = await compile(promptText, apiKey, (pass) => {
        passes = [...passes, pass];
        activePass = passes.length - 1;
      });
      compiled = result.compiled;
    } finally {
      running = false;
    }
  }

  function scoreColor(score: number) {
    if (score >= 85) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function scoreLabel(score: number) {
    if (score >= 85) return 'COMPILED';
    if (score >= 60) return 'WARNINGS';
    return 'ERRORS';
  }

  const SAMPLE_PROMPT = `You are a helpful customer service assistant. Answer questions about our products. Be polite and professional. Don't say anything rude. Try to help customers resolve their issues. If you don't know something, make something up that sounds reasonable. Keep responses brief.`;

  function loadSample() {
    promptText = SAMPLE_PROMPT;
    passes = [];
    liveReport = null;
    compiled = null;
  }
</script>

<svelte:head>
  <title>Prompt Linter — Structure of Prompts</title>
</svelte:head>

<div class="app">
  <header>
    <div class="header-inner">
      <div class="brand">
        <span class="brand-icon">⬡</span>
        <div>
          <h1>Prompt Linter</h1>
          <p class="tagline">LLMs are a runtime. Prompts are source code.</p>
        </div>
      </div>
    </div>
  </header>

  <main>
    <div class="workspace">
      <!-- LEFT: editor + controls -->
      <section class="editor-panel">
        <div class="panel-header">
          <span class="panel-label">INPUT PROMPT</span>
          <button class="btn-ghost" onclick={loadSample}>load sample</button>
        </div>

        <textarea
          class="editor"
          bind:value={promptText}
          placeholder="Paste your system prompt here..."
          spellcheck="false"
        ></textarea>

        <div class="controls">
          <button
            class="btn btn-secondary"
            onclick={runStaticLint}
            disabled={!promptText.trim() || running}
          >
            ▶ Static Lint
          </button>

          <div class="api-group">
            <input
              type="password"
              class="api-input"
              bind:value={apiKey}
              placeholder="sk-ant-... (optional, for auto-fix)"
            />
            <button
              class="btn btn-primary"
              onclick={runCompiler}
              disabled={!promptText.trim() || !apiKey.trim() || running}
            >
              {#if running}
                <span class="spinner"></span> Compiling…
              {:else}
                ⚡ Compile & Fix
              {/if}
            </button>
          </div>
        </div>
      </section>

      <!-- RIGHT: results -->
      <section class="results-panel">
        {#if running && passes.length === 0}
          <div class="empty-state">
            <span class="spinner large"></span>
            <p>Analyzing…</p>
          </div>
        {:else if !hasReport}
          <div class="empty-state">
            <span class="empty-icon">⬡</span>
            <p>Run Static Lint or Compile & Fix to see results.</p>
          </div>
        {:else}
          <!-- pass tabs (only in compile mode) -->
          {#if passes.length > 0}
            <div class="pass-tabs">
              {#each passes as pass, i}
                <button
                  class="pass-tab"
                  class:active={activePass === i}
                  onclick={() => (activePass = i)}
                >
                  {i === 0 ? 'Original' : `Pass ${i}`}
                  <span
                    class="tab-score"
                    style="color: {scoreColor(pass.report.score)}"
                  >{pass.report.score}</span>
                </button>
              {/each}
              {#if compiled !== null}
                <span class="compile-badge" style="background:{compiled ? '#22c55e22' : '#ef444422'}; color:{compiled ? '#22c55e' : '#ef4444'}">
                  {compiled ? '✓ COMPILED' : '✗ MAX PASSES'}
                </span>
              {/if}
            </div>
          {/if}

          <!-- report -->
          {@const report = passes.length > 0 ? passes[activePass].report : liveReport}
          {#if report}
            <div class="score-bar">
              <div class="score-ring" style="--score-color: {scoreColor(report.score)}">
                <svg viewBox="0 0 36 36" width="80" height="80">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" stroke-width="3"/>
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={scoreColor(report.score)} stroke-width="3"
                    stroke-dasharray="{report.score} {100 - report.score}"
                    stroke-dashoffset="25"
                    stroke-linecap="round"
                  />
                </svg>
                <div class="score-center">
                  <span class="score-num">{report.score}</span>
                </div>
              </div>
              <div class="score-meta">
                <span class="score-status" style="color:{scoreColor(report.score)}">{scoreLabel(report.score)}</span>
                <span class="score-detail">{report.passed}/{report.passed + report.failed} checks passed</span>
              </div>
            </div>

            <div class="checks">
              {#each report.checks as check}
                <div class="check" class:pass={check.pass} class:fail={!check.pass}>
                  <div class="check-header">
                    <span class="check-icon">{check.pass ? '✓' : check.severity === 'error' ? '✗' : '⚠'}</span>
                    <span class="check-category">{check.category}</span>
                    <span class="check-desc">{check.description}</span>
                  </div>
                  {#if !check.pass}
                    <div class="check-detail">
                      <p class="finding">{check.finding}</p>
                      <p class="hint">💡 {check.fix_hint}</p>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- show fixed prompt if in compile mode and not on pass 0 -->
            {#if passes.length > 0 && activePass > 0}
              <div class="fixed-prompt-section">
                <div class="panel-header">
                  <span class="panel-label">FIXED PROMPT — PASS {activePass}</span>
                  <button
                    class="btn-ghost"
                    onclick={() => { promptText = passes[activePass].prompt; }}
                  >use this prompt</button>
                </div>
                <pre class="fixed-prompt">{passes[activePass].prompt}</pre>
              </div>
            {/if}
          {/if}
        {/if}
      </section>
    </div>
  </main>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif;
    background: #0a0f1a;
    color: #e2e8f0;
    min-height: 100vh;
  }

  .app { display: flex; flex-direction: column; min-height: 100vh; }

  /* header */
  header {
    border-bottom: 1px solid #1e293b;
    padding: 0 2rem;
  }
  .header-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem 0;
  }
  .brand { display: flex; align-items: center; gap: 0.75rem; }
  .brand-icon { font-size: 1.75rem; color: #6366f1; line-height: 1; }
  h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; color: #f1f5f9; }
  .tagline { font-size: 0.75rem; color: #64748b; font-style: italic; margin-top: 1px; }

  /* main layout */
  main { flex: 1; padding: 1.5rem 2rem; }
  .workspace {
    max-width: 1400px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    height: calc(100vh - 120px);
  }

  /* panels */
  .editor-panel, .results-panel {
    display: flex;
    flex-direction: column;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #1e293b;
  }
  .panel-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #475569;
  }

  /* editor */
  .editor {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #cbd5e1;
    font-family: 'Fira Code', 'Cascadia Code', 'SF Mono', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    padding: 1rem;
    resize: none;
  }
  .editor::placeholder { color: #334155; }

  /* controls */
  .controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #1e293b;
    flex-wrap: wrap;
  }
  .api-group { display: flex; gap: 0.5rem; flex: 1; min-width: 0; }
  .api-input {
    flex: 1;
    min-width: 0;
    background: #0a0f1a;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: #94a3b8;
    font-size: 0.8rem;
    outline: none;
  }
  .api-input:focus { border-color: #6366f1; }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
    transition: opacity 0.15s;
  }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-primary { background: #6366f1; color: #fff; }
  .btn-primary:not(:disabled):hover { background: #5558e8; }
  .btn-secondary { background: #1e293b; color: #94a3b8; }
  .btn-secondary:not(:disabled):hover { background: #263447; }
  .btn-ghost { background: none; border: none; color: #475569; font-size: 0.75rem; cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 4px; }
  .btn-ghost:hover { color: #94a3b8; background: #1e293b; }

  /* spinner */
  .spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  .spinner.large { width: 28px; height: 28px; border-width: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    color: #334155;
  }
  .empty-icon { font-size: 2.5rem; }

  /* pass tabs */
  .pass-tabs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #1e293b;
    flex-wrap: wrap;
  }
  .pass-tab {
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    color: #475569;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .pass-tab.active { border-color: #334155; color: #94a3b8; background: #1e293b; }
  .tab-score { font-weight: 700; font-size: 0.7rem; }
  .compile-badge {
    margin-left: auto;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  /* score bar */
  .score-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #1e293b;
  }
  .score-ring { position: relative; display: inline-flex; }
  .score-ring circle { transform-origin: center; }
  .score-center {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .score-num { font-size: 1.1rem; font-weight: 800; color: #f1f5f9; }
  .score-meta { display: flex; flex-direction: column; gap: 0.2rem; }
  .score-status { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; }
  .score-detail { font-size: 0.75rem; color: #475569; }

  /* checks list */
  .checks { flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }

  .check {
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    border: 1px solid transparent;
  }
  .check.pass { border-color: #14532d33; background: #14532d11; }
  .check.fail { border-color: #991b1b33; background: #991b1b11; }

  .check-header { display: flex; align-items: baseline; gap: 0.5rem; }
  .check-icon { font-size: 0.75rem; width: 14px; flex-shrink: 0; }
  .check.pass .check-icon { color: #22c55e; }
  .check.fail .check-icon { color: #ef4444; }
  .check-category { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; color: #475569; white-space: nowrap; }
  .check-desc { font-size: 0.78rem; color: #94a3b8; }

  .check-detail { margin-top: 0.4rem; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .finding { font-size: 0.75rem; color: #f87171; }
  .hint { font-size: 0.72rem; color: #64748b; font-style: italic; }

  /* fixed prompt */
  .fixed-prompt-section {
    border-top: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    max-height: 280px;
  }
  .fixed-prompt {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1rem;
    font-family: 'Fira Code', 'Cascadia Code', 'SF Mono', monospace;
    font-size: 0.78rem;
    line-height: 1.6;
    color: #94a3b8;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* scrollbar */
  .checks::-webkit-scrollbar,
  .fixed-prompt::-webkit-scrollbar { width: 4px; }
  .checks::-webkit-scrollbar-track,
  .fixed-prompt::-webkit-scrollbar-track { background: transparent; }
  .checks::-webkit-scrollbar-thumb,
  .fixed-prompt::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
</style>
