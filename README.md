# Prompt Linter

> *LLMs are a runtime. Prompts are source code.*

A static analysis tool for system prompts. Paste a prompt, get a structured lint report. Optionally wire in Claude to auto-fix failures and recompile — recursively — until the prompt passes.

Built on the framework from **The Structure of Prompts**, which treats natural language prompts as first-class engineering artifacts with identifiable structural constructs: identity declarations, guard clauses, state machines, output contracts, event handlers, and more.

---

## What It Does

**Static Lint** runs 17 deterministic checks derived from the Appendix F checklist and supporting chapters, returning a structured report with pass/fail per category, severity, and a concrete fix hint for each failure.

**Compile & Fix** sends the prompt and lint report to Claude with a structured repair instruction. Claude returns a corrected prompt. The linter re-runs. If failures remain, the loop repeats — up to 4 passes — until the prompt compiles clean or max iterations are hit. The linter is the oracle, not Claude's judgment.

---

## Checks

| Category | Check | Sev | Chapter |
|---|---|---|---|
| **Identity & Contract** | Explicit identity declaration | error | 3.1 |
| **Identity & Contract** | Capability boundary defined | warning | 3.1 |
| **Identity & Contract** | Constraint boundary defined | error | 3.1 |
| **Identity & Contract** | Knowledge boundary defined | warning | 7.4 |
| **Identity & Contract** | Role contract complete (Identity + Capability + Boundary) | error | 7.1 |
| **Semantics** | Negations paired with positive redirects | info | 2.5 |
| **Semantics** | Active voice used for behavioral instructions | info | 2.4 |
| **Control Flow** | Multi-step procedures use numbered sequential steps | warning | 5.1 |
| **Control Flow** | Blocking gates on steps requiring user input | warning | 5.3 |
| **Guard Clauses** | Hard constraints use symbolic anchors (NEVER/ALWAYS) | error | 9.1–9.2 |
| **Guard Clauses** | Conflict resolution / priority ordering declared | warning | 9.3 |
| **State** | Tracked state is explicitly named | warning | 4.1 |
| **State** | State scope declared (session vs. turn) | warning | 4.2 |
| **Event Handling** | Signal/response handlers defined | warning | 10.1 |
| **Error Handling** | Failure / fallback behavior declared | warning | 14.3 |
| **Output** | Output format explicitly specified | warning | 21.2 |
| **Security** | Security protocol with violation ladder | warning | 16.3 |

Severity: `error` = 10 pts, `warning` = 5 pts, `info` = 2 pts. Score is 0–100.

---

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/docs/svelte) (runes)
- TypeScript
- [Anthropic SDK](https://github.com/anthropic-ai/anthropic-sdk-typescript) (`claude-opus-4-5`)
- No UI framework — plain CSS with custom properties for light/dark mode

---

## Getting Started

```bash
git clone https://github.com/brokerdoctor/prompt-linter
cd prompt-linter
npm install
cp .env.example .env
# add your key to .env
npm run dev
```

Open [localhost:5173](http://localhost:5173).

---

## Environment

```
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

The key is read server-side only. The UI accepts an optional override key (useful for demoing with a different account) — if omitted, the `.env` key is used. If neither is set, "Compile & Fix" returns an error.

For Vercel: add `ANTHROPIC_API_KEY` in **Project Settings → Environment Variables**.

---

## Architecture

```
src/
  lib/
    linter.ts      # Static analysis engine — 17 checks, pure deterministic TS
    compiler.ts    # Claude compile loop — lint → fix → re-lint, up to 4 passes
  routes/
    +page.svelte   # Single-page UI — editor, lint report, iteration trace
    api/
      lint/        # POST /api/lint — run static analysis
      fix/         # POST /api/fix  — run full compile loop (server-side, uses env key)
```

The static linter has no external dependencies and can be imported anywhere:

```ts
import { lint } from '$lib/linter';

const report = lint(myPrompt);
// { score: 42, passed: 6, failed: 11, checks: [...] }
```

---

## The Framework

The checks are derived from *The Structure of Prompts*, a reference for engineers who build with language models. The thesis: LLMs are a runtime, and prompts have structural equivalents for every fundamental programming construct — variables, control flow, state machines, interfaces, guard clauses, event handlers, encapsulation.

The checks map to specific chapters:

- **Ch 2** — Semantics of instruction: active voice, negation/redirect, symbolic anchors
- **Ch 4** — Variables and state: named state, scope declaration
- **Ch 5** — Control flow: sequential steps, blocking gates
- **Ch 7** — Interfaces and contracts: role contract, knowledge boundary
- **Ch 9** — Guard clauses: NEVER/ALWAYS, priority ordering
- **Ch 10** — Event handlers: signal/response pairs
- **Ch 14** — Error handling: failure contracts, graceful degradation
- **Ch 16** — Security: restricted topics, violation ladder
- **Ch 21** — Agent-as-API: output contract

The Appendix F checklist this tool implements is the static analysis pass a prompt engineer should run before shipping any system prompt to production.
