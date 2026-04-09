export type Severity = 'error' | 'warning';

export interface LintCheck {
  id: string;
  category: string;
  description: string;
  severity: Severity;
  pass: boolean;
  finding: string;
  fix_hint: string;
}

export interface LintReport {
  score: number; // 0-100
  passed: number;
  failed: number;
  checks: LintCheck[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

const has = (text: string, ...patterns: RegExp[]) =>
  patterns.some((p) => p.test(text));

const count = (text: string, pattern: RegExp) =>
  (text.match(pattern) ?? []).length;

// ── checks ───────────────────────────────────────────────────────────────────

function checkIdentity(text: string): LintCheck {
  const pass = has(
    text,
    /\byou are\b/i,
    /\byour role\b/i,
    /\bidentity\b/i,
    /\byou(?:'re| are) a(?:n)?\b/i,
    /^#{1,3}\s*(identity|role|persona)/im,
    /\bact as\b/i
  );
  return {
    id: 'identity',
    category: 'Identity & Contract',
    description: 'Agent has an explicit identity declaration',
    severity: 'error',
    pass,
    finding: pass ? 'Identity declaration found.' : 'No identity declaration detected. The agent has no defined role.',
    fix_hint: 'Add an opening statement like "You are [NAME], a [ROLE] responsible for [PURPOSE]."'
  };
}

function checkCapabilityBoundary(text: string): LintCheck {
  const pass = has(
    text,
    /\byou (?:can|will|are able to|handle|help with|assist with)\b/i,
    /\bcapabilit/i,
    /\byour (?:job|task|purpose|function|responsibility) is\b/i,
    /\bresponsible for\b/i
  );
  return {
    id: 'capability',
    category: 'Identity & Contract',
    description: 'Capability boundary is defined',
    severity: 'warning',
    pass,
    finding: pass ? 'Capability scope found.' : 'No capability boundary defined. The agent has no declared scope of action.',
    fix_hint: 'Add a "You can / You will" section listing what the agent does.'
  };
}

function checkConstraintBoundary(text: string): LintCheck {
  const pass = has(
    text,
    /\bnever\b/i,
    /\bdo not\b/i,
    /\byou must not\b/i,
    /\boff[- ]?limits\b/i,
    /\bout of scope\b/i,
    /\bdo not discuss\b/i,
    /\brefuse\b/i,
    /\bcannot\b/i
  );
  return {
    id: 'constraint',
    category: 'Identity & Contract',
    description: 'Constraint boundary is defined',
    severity: 'error',
    pass,
    finding: pass ? 'Constraint boundary found.' : 'No constraints defined. The agent has no behavioral guardrails.',
    fix_hint: 'Add explicit constraints using NEVER, "You must not", or "Do not" with specific conditions.'
  };
}

function checkKnowledgeBoundary(text: string): LintCheck {
  const pass = has(
    text,
    /\b(?:you (?:do not|don't) know|you have no (?:access|knowledge))\b/i,
    /\bknowledge boundary\b/i,
    /\bdoes not know\b/i,
    /\bnot (?:aware|privy)\b/i,
    /\byou (?:only|solely) have access to\b/i,
    /\bout of scope\b/i,
    /what .{0,30} (?:does not|doesn't) know/i
  );
  return {
    id: 'knowledge_boundary',
    category: 'Identity & Contract',
    description: 'Knowledge boundary is defined',
    severity: 'warning',
    pass,
    finding: pass ? 'Knowledge boundary found.' : 'No knowledge boundary declared. Agent may answer outside its intended scope.',
    fix_hint: 'Add a "What you do not know" section listing topics the agent should not address.'
  };
}

function checkSequentialSteps(text: string): LintCheck {
  // Look for numbered steps (1. 2. 3. or 1) 2) 3))
  const numberedSteps = count(text, /^\s*\d+[\.\)]\s+/gm);
  const pass = numberedSteps >= 3;
  return {
    id: 'sequential_steps',
    category: 'Control Flow',
    description: 'Multi-step procedures use numbered steps',
    severity: 'warning',
    pass,
    finding: pass
      ? `Found ${numberedSteps} numbered steps.`
      : numberedSteps === 0
      ? 'No numbered steps found. Implicit ordering is unreliable.'
      : 'Fewer than 3 numbered steps — may be insufficient for a procedure.',
    fix_hint: 'Replace prose descriptions of sequences with explicit numbered steps: "1. [step] 2. [step] 3. [step]"'
  };
}

function checkBlockingGates(text: string): LintCheck {
  const pass = has(
    text,
    /<WAIT\b/i,
    /\bwait for\b/i,
    /\bdo not proceed until\b/i,
    /\bbefore (?:continuing|proceeding|moving on)\b/i,
    /\bpause\b.*\buntil\b/i
  );
  return {
    id: 'blocking_gates',
    category: 'Control Flow',
    description: 'Steps requiring user input use explicit blocking markers',
    severity: 'warning',
    pass,
    finding: pass ? 'Blocking gate pattern found.' : 'No blocking gates found. Multi-step sequences may collapse into a single response.',
    fix_hint: 'Use <WAIT FOR [CONDITION]> or "Do not proceed until [USER ACTION]" to create explicit pause points.'
  };
}

function checkGuardClauses(text: string): LintCheck {
  // NEVER in allcaps or "you must never" — symbolic anchors
  const hardGuards = count(text, /\bNEVER\b/g) + count(text, /\bALWAYS\b/g);
  const softGuards = count(text, /\byou must not\b/gi) + count(text, /\bdo not\b/gi);
  const pass = hardGuards >= 1 || softGuards >= 2;
  return {
    id: 'guard_clauses',
    category: 'Guard Clauses',
    description: 'Hard constraints use symbolic anchors (NEVER/ALWAYS)',
    severity: 'error',
    pass,
    finding: pass
      ? `Found ${hardGuards} symbolic anchor(s) (NEVER/ALWAYS), ${softGuards} soft guard(s).`
      : 'No symbolic anchor guards found. Behavioral constraints without NEVER/ALWAYS are unreliable.',
    fix_hint: 'Replace "do not" or "avoid" with ALL-CAPS NEVER or ALWAYS for critical behavioral constraints.'
  };
}

function checkOutputContract(text: string): LintCheck {
  const pass = has(
    text,
    /\brespond (?:only|always) with\b/i,
    /\boutput (?:format|contract)\b/i,
    /\bformat your (?:response|output|reply)\b/i,
    /\bjson\b/i,
    /\byour response (?:must|should) (?:be|include|contain)\b/i,
    /\breturn (?:a|an|only|the)\b/i,
    /\bresponse format\b/i
  );
  return {
    id: 'output_contract',
    category: 'Output',
    description: 'Output format is explicitly specified',
    severity: 'warning',
    pass,
    finding: pass ? 'Output contract found.' : 'No output format specified. Consumer has no contract to rely on.',
    fix_hint: 'Add an explicit output section: "Respond ONLY with [FORMAT]. Include: [FIELD-1], [FIELD-2]."'
  };
}

function checkEventHandlers(text: string): LintCheck {
  // "when [signal], [response]" pattern
  const handlers = count(text, /\bwhen\s+.{3,80}[,:]?\s+(?:you\s+(?:should|must|will)|respond|say|do|ask|provide)/gi);
  const pass = handlers >= 1;
  return {
    id: 'event_handlers',
    category: 'Event Handling',
    description: 'Signal/response handlers are defined',
    severity: 'warning',
    pass,
    finding: pass ? `Found ${handlers} event handler(s).` : 'No signal/response pairs found. Edge case behavior is undefined.',
    fix_hint: 'Add handlers: "When [USER SIGNAL], [AGENT RESPONSE]." for key scenarios like confusion, out-of-scope requests, or errors.'
  };
}

function checkSecurityProtocol(text: string): LintCheck {
  const hasViolationLadder = has(
    text,
    /first (?:violation|time|attempt)/i,
    /second (?:violation|time|attempt)/i,
    /violation ladder/i,
    /escalat/i
  );
  const hasRestricted = has(
    text,
    /\bnever discuss\b/i,
    /\brestricted\b/i,
    /\bconfidential\b/i,
    /\bdo not (?:reveal|share|disclose)\b/i,
    /\bsecurity\b/i
  );
  const pass = hasViolationLadder || (hasRestricted && count(text, /\bNEVER\b/g) >= 1);
  return {
    id: 'security',
    category: 'Security',
    description: 'Security protocol with violation ladder defined',
    severity: 'warning',
    pass,
    finding: pass ? 'Security protocol found.' : 'No security/violation handling defined.',
    fix_hint: 'Add a SECURITY block: "NEVER discuss [X]. First violation: [warn]. Second violation: [escalate]."'
  };
}

function checkStateDeclared(text: string): LintCheck {
  const pass = has(
    text,
    /\btrack\b.*\bthroughout\b/i,
    /\bremember\b/i,
    /\bmaintain\s+(?:a\s+)?(?:list|record|log|state|count|track)/i,
    /\bkeep track of\b/i,
    /\bstate\b.*\b(?:session|turn|conversation)\b/i,
    /\b(?:session|conversation) (?:state|context|memory)\b/i
  );
  return {
    id: 'state',
    category: 'State',
    description: 'Tracked state is explicitly named',
    severity: 'warning',
    pass,
    finding: pass ? 'State tracking declaration found.' : 'No explicit state declarations. Agent may lose context across turns.',
    fix_hint: 'Declare state explicitly: "[NAME] is [VALUE]. Track [NAME] throughout this interaction."'
  };
}

// ── runner ───────────────────────────────────────────────────────────────────

const ALL_CHECKS = [
  checkIdentity,
  checkCapabilityBoundary,
  checkConstraintBoundary,
  checkKnowledgeBoundary,
  checkSequentialSteps,
  checkBlockingGates,
  checkGuardClauses,
  checkOutputContract,
  checkEventHandlers,
  checkSecurityProtocol,
  checkStateDeclared
];

export function lint(prompt: string): LintReport {
  const checks = ALL_CHECKS.map((fn) => fn(prompt));
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  // Errors count double toward score penalty
  const errorFails = checks.filter((c) => !c.pass && c.severity === 'error').length;
  const warnFails = checks.filter((c) => !c.pass && c.severity === 'warning').length;
  const penalty = errorFails * 12 + warnFails * 6;
  const score = Math.max(0, 100 - penalty);
  return { score, passed, failed, checks };
}
