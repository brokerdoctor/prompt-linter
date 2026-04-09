# Prompt Linter

> *LLMs are a runtime. Prompts are source code.*

A static analysis tool for system prompts. Paste a prompt, get a structured lint report. Optionally wire in Claude to auto-fix failures and recompile — recursively — until the prompt passes.

Built on the framework from **[The Structure of Prompts](https://github.com/brokerdoctor/prompt-linter)**, which treats natural language prompts as first-class engineering artifacts with identifiable structural constructs: identity declarations, guard clauses, state machines, output contracts, event handlers, and more.

---

## What It Does

**Static Lint** runs 11 deterministic checks derived from the Appendix F checklist, returning a structured report with pass/fail per category, severity, and a concrete fix hint for each failure.

**Compile & Fix** sends the prompt and lint report to Claude with a structured repair instruction. Claude returns a corrected prompt. The linter re-runs. If failures remain, the loop repeats — up to 4 passes — until the prompt compiles clean or max iterations are hit. The linter is the oracle, not Claude's judgment.

---

## Checks

| Category | Check |
|---|---|
| **Identity & Contract** | Explicit identity declaration |
| **Identity & Contract** | Capability boundary defined |
| **Identity & Contract** | Constraint boundary defined |
| **Identity & Contract** | Knowledge boundary defined |
| **Control Flow** | Multi-step procedures use numbered steps |
| **Control Flow** | Blocking gates on steps requiring user input |
| **Guard Clauses** | Hard constraints use symbolic anchors (NEVER/ALWAYS) |
| **State** | Tracked state is explicitly named |
| **Event Handling** | Signal/response handlers defined |
| **Security** | Security protocol with violation ladder |
| **Output** | Output format explicitly specified |

Each check returns a severity (`error` or `warning`), a finding description, and a fix hint. The score is 0–100 with error failures weighted double.

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
    linter.ts      # Static analysis engine — 11 checks, pure deterministic TS
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
// { score: 42, passed: 4, failed: 7, checks: [...] }
```

---

## The Framework

The checks are derived from *The Structure of Prompts*, a reference for engineers who build with language models. The thesis: LLMs are a runtime, and prompts have structural equivalents for every fundamental programming construct — variables, control flow, state machines, interfaces, guard clauses, event handlers, encapsulation.

The Appendix F checklist this tool implements is the static analysis pass a prompt engineer should run before shipping any system prompt to production.
