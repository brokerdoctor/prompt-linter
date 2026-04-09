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

The lint report is based on "The Structure of Prompts" framework, which treats prompts as source code. The constructs are:
- Identity declaration: "You are [NAME], a [ROLE]..."
- Capability boundary: explicit list of what the agent does
- Constraint boundary: NEVER/ALWAYS guards with symbolic anchors
- Knowledge boundary: explicit list of what the agent does NOT know
- Sequential steps: numbered steps for multi-step procedures
- Blocking gates: <WAIT FOR [CONDITION]> to prevent collapsing multi-step sequences
- Guard clauses: NEVER / ALWAYS in ALL-CAPS as symbolic anchors
- Output contract: explicit response format specification
- Event handlers: "When [SIGNAL], [RESPONSE]" pairs
- Security protocol: NEVER discuss + violation ladder
- State declarations: named tracked state with explicit scope

RULES:
- Return ONLY the corrected prompt text. No explanation, no preamble, no markdown fences.
- Preserve the original intent and content. Only add or strengthen structural constructs.
- Use ALL-CAPS NEVER and ALWAYS for guard clauses.
- Add missing sections at logical positions in the prompt.
- Keep the prompt concise — do not pad.`;

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
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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
