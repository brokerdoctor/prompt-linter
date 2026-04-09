import Anthropic from '@anthropic-ai/sdk';
import { lint, type LintReport } from './linter.js';

export interface CompilePass {
  iteration: number;
  prompt: string;
  report: LintReport;
}

export interface CompileResult {
  passes: CompilePass[];
  compiled: boolean;
  finalPrompt: string;
}

const MAX_ITERATIONS = 4;

const SYSTEM = `You are a prompt engineer and compiler. Your job is to take a system prompt and a lint report, and return a corrected version of the prompt that fixes all failing checks.

The lint report is based on "The Structure of Prompts" framework, which treats prompts as source code.

CONSTRUCT CATALOG:
- identity: "You are [NAME], a [ROLE] responsible for [PURPOSE]."
- capability: explicit "You will / You can" list of what the agent does
- constraint: NEVER/ALWAYS guards with symbolic anchors
- knowledge_boundary: explicit "What you do not know" section
- role_contract: all three present — Identity + Capability + Boundary (Ch 7.1)
- negation_redirect: replace "Do not X" with "Do Y instead" — redirect, do not suppress (Ch 2.5)
- passive_voice: replace "information should not be revealed" with "You must never reveal" (Ch 2.4)
- sequential_steps: numbered consecutive steps for procedures (Ch 5.1)
- blocking_gates: <WAIT FOR [CONDITION]> to prevent collapsing multi-step sequences (Ch 5.3)
- guard_clauses: NEVER / ALWAYS in ALL-CAPS as symbolic anchors (Ch 9.1–9.2)
- priority_ordering: "When instructions conflict, apply in this order: [P1] > [P2] > [P3]." (Ch 9.3)
- state: "[NAME] is [VALUE]. Track [NAME] throughout this interaction." (Ch 4.1)
- state_scope: declare "throughout this session" or "reset each turn" for any tracked state (Ch 4.2)
- event_handlers: "When [SIGNAL], [RESPONSE]." pairs (Ch 10.1)
- failure_contract: "If [FAILURE], [FALLBACK]. If fallback fails, [TERMINAL]." (Ch 14.3)
- output_contract: "Respond ONLY with [FORMAT]. Include: [FIELD-1], [FIELD-2]." (Ch 21.2)
- security: SECURITY block with NEVER discuss + violation ladder (Ch 16.3)

PROCEDURE:
1. Parse the original prompt to identify existing constructs
2. Parse the lint report to identify all failing checks
3. For each failing check, apply the canonical fix at a logical position in the prompt
4. Verify the corrected prompt preserves original intent
5. Return only the corrected prompt text

STATE:
- ORIGINAL_PROMPT is the input prompt text. Track throughout correction.
- FAILING_CHECKS is the list of warnings from lint report. Track until all resolved.

RULES:
- ALWAYS return ONLY the corrected prompt text. No explanation, no preamble, no markdown fences.
- ALWAYS preserve the original intent and content. Only add or strengthen structural constructs.
- ALWAYS use ALL-CAPS NEVER and ALWAYS for guard clauses.
- ALWAYS add missing sections at logical positions in the prompt.
- NEVER pad the prompt with unnecessary content.
- NEVER add a security block unless the original prompt has confidentiality intent.
- When fixing passive_voice, convert agent-instruction sentences only — not descriptive prose.
- When fixing negation_redirect, add "instead, [positive action]" immediately after the negation.

EVENT HANDLERS:
- When lint report contains no failing checks, return the original prompt unchanged.
- When a fix conflicts with original intent, preserve intent and apply minimal fix.
- When multiple fixes target the same section, combine them coherently.
- When user requests changes outside prompt correction scope, decline and explain purpose.`;

function buildUserMessage(prompt: string, report: LintReport): string {
  const failures = report.checks
    .filter((c) => !c.pass)
    .map((c) => `[${c.severity.toUpperCase()}] ${c.category} — ${c.description}\n  Finding: ${c.finding}\n  Fix: ${c.fix_hint}`)
    .join('\n\n');

  return `ORIGINAL PROMPT:
${prompt}

LINT REPORT (score: ${report.score}/100, ${report.failed} failing):
${failures}

Return the corrected prompt:`;
}

export async function compile(
  initialPrompt: string,
  apiKey: string,
  onProgress: (pass: CompilePass) => void
): Promise<CompileResult> {
  const client = new Anthropic({ apiKey });

  const passes: CompilePass[] = [];
  let currentPrompt = initialPrompt;

  // Pass 0 — static lint of original
  const initialReport = lint(currentPrompt);
  const pass0: CompilePass = { iteration: 0, prompt: currentPrompt, report: initialReport };
  passes.push(pass0);
  onProgress(pass0);

  if (initialReport.failed === 0) {
    return { passes, compiled: true, finalPrompt: currentPrompt };
  }

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const prevReport = passes[passes.length - 1].report;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserMessage(currentPrompt, prevReport) }]
    });

    const fixed = (message.content[0] as { type: string; text: string }).text.trim();
    const report = lint(fixed);
    const pass: CompilePass = { iteration: i, prompt: fixed, report };
    passes.push(pass);
    onProgress(pass);

    currentPrompt = fixed;

    if (report.failed === 0) {
      return { passes, compiled: true, finalPrompt: currentPrompt };
    }
  }

  return { passes, compiled: false, finalPrompt: currentPrompt };
}
