export type Severity = 'error' | 'warning' | 'info';

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

// Returns all matches for a pattern
const matches = (text: string, pattern: RegExp): RegExpMatchArray[] => {
  const results: RegExpMatchArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
};

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
  // Look for numbered steps (1. 2. 3. or 1) 2) 3)) — require at least two consecutive numbers
  const stepMatches = matches(text, /^\s*(\d+)[\.\)]\s+/m);
  const numberedSteps = count(text, /^\s*\d+[\.\)]\s+/gm);
  // Check for actual sequence: two numbers that are consecutive somewhere in the text
  const hasSequence = stepMatches.some((m) => {
    const n = parseInt(m[1], 10);
    return new RegExp(`^\\s*${n + 1}[\\.)]\\ `, 'm').test(text);
  });
  const pass = hasSequence && numberedSteps >= 2;
  return {
    id: 'sequential_steps',
    category: 'Control Flow',
    description: 'Multi-step procedures use numbered sequential steps',
    severity: 'warning',
    pass,
    finding: pass
      ? `Found ${numberedSteps} numbered steps in sequence.`
      : numberedSteps === 0
      ? 'No numbered steps found. Implicit ordering is unreliable (Ch 5.1).'
      : 'Numbered items found but no consecutive sequence detected — may be unordered lists, not procedures.',
    fix_hint: 'Use explicit sequential numbering for procedures: "1. [step] 2. [step] 3. [step]". See Ch 5.1.'
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

function checkPriorityOrdering(text: string): LintCheck {
  // Ch 9.3 — explicit conflict resolution / priority declaration
  const pass = has(
    text,
    /when (?:instructions?|rules?) conflict/i,
    /priority order/i,
    /in (?:this|the following) order[:\s]/i,
    /takes? precedence/i,
    /override[s]?\b.*\bif\b/i,
    /\bpriority\b.*[:>]/i,
    /higher priority/i
  );
  return {
    id: 'priority_ordering',
    category: 'Guard Clauses',
    description: 'Conflict resolution / priority ordering declared',
    severity: 'warning',
    pass,
    finding: pass
      ? 'Priority ordering found.'
      : 'No priority ordering declared. When instructions conflict the model will guess (Ch 9.3).',
    fix_hint: 'Add: "When instructions conflict, apply them in this order: [PRIORITY-1] > [PRIORITY-2] > [PRIORITY-3]."'
  };
}

function checkNegationRedirect(text: string): LintCheck {
  // Ch 2.5 — bare "do not X" without a positive redirect is an antipattern
  const bareNegations = count(text, /\bdo not\b(?!.*\binstead\b)(?!.*\brather\b)/gi)
    + count(text, /\byou must not\b(?!.*\binstead\b)/gi);
  const redirects = count(text, /\binstead\b/gi)
    + count(text, /\brather\b/gi)
    + count(text, /\bdo [A-Z]/g);  // "Do Y" positive redirect after a negation
  // Pass if: no bare negations, OR redirects balance them, OR prompt uses NEVER (symbolic anchor already)
  const nevCount = count(text, /\bNEVER\b/g);
  const pass = bareNegations === 0 || redirects >= bareNegations || nevCount >= bareNegations;
  return {
    id: 'negation_redirect',
    category: 'Semantics',
    description: 'Negations paired with positive redirects ("Do Y instead")',
    severity: 'info',
    pass,
    finding: pass
      ? 'Negations appear adequately paired or anchored.'
      : `Found ${bareNegations} bare negation(s) without redirect. "Do not X" forces the model to represent and suppress X (Ch 2.5).`,
    fix_hint: 'Replace "Do not X" with "Do Y instead" — redirect rather than suppress. Or use NEVER for hard guards.'
  };
}

function checkPassiveVoice(text: string): LintCheck {
  // Ch 2.4 — passive constructions reduce behavioral binding reliability
  const passiveCount = count(text, /\bshould (?:not )?be\b/gi)
    + count(text, /\bwill be\b/gi)
    + count(text, /\bmust be\b/gi)
    + count(text, /\bis (?:required|expected|preferred)\b/gi)
    + count(text, /\binformation (?:should|must|will) (?:not )?be\b/gi);
  const activeCount = count(text, /\byou (?:must|will|should|shall)\b/gi)
    + count(text, /\bNEVER\b/g)
    + count(text, /\bALWAYS\b/g);
  // Pass if active constructions dominate or passive is minimal
  const pass = passiveCount === 0 || activeCount >= passiveCount * 2;
  return {
    id: 'passive_voice',
    category: 'Semantics',
    description: 'Active voice used for behavioral instructions',
    severity: 'info',
    pass,
    finding: pass
      ? 'Instructions predominantly use active voice.'
      : `Found ${passiveCount} passive construction(s) vs ${activeCount} active. Passive voice reduces behavioral binding (Ch 2.4).`,
    fix_hint: 'Replace "Information should not be revealed" with "You must never reveal". Active + second-person binds more reliably.'
  };
}

function checkRoleContract(text: string): LintCheck {
  // Ch 7.1 — role contract requires all three: Identity, Capability, Boundary
  const hasIdentity = has(text, /\byou are\b/i, /\byour role\b/i, /\bact as\b/i, /\byou(?:'re| are) a(?:n)?\b/i);
  const hasCapability = has(text, /\byou (?:can|will|handle|help|assist)\b/i, /\bresponsible for\b/i, /\byour (?:job|task|purpose)\b/i);
  const hasBoundary = has(text, /\bNEVER\b/, /\byou must not\b/i, /\bdo not\b/i, /\bout of scope\b/i, /\bwill not\b/i);
  const triadCount = [hasIdentity, hasCapability, hasBoundary].filter(Boolean).length;
  const pass = triadCount === 3;
  return {
    id: 'role_contract',
    category: 'Identity & Contract',
    description: 'Role contract complete: Identity + Capability + Boundary',
    severity: 'error',
    pass,
    finding: pass
      ? 'Role contract triad (Identity, Capability, Boundary) complete.'
      : `Role contract incomplete — missing: ${[!hasIdentity && 'Identity', !hasCapability && 'Capability', !hasBoundary && 'Boundary'].filter(Boolean).join(', ')}. (Ch 7.1)`,
    fix_hint: 'A complete role contract needs all three: "You are [X]" (Identity) + "You will [Y]" (Capability) + "You must never [Z]" (Boundary).'
  };
}

function checkFailureContract(text: string): LintCheck {
  // Ch 14.3 — graceful degradation / failure fallback declared
  const pass = has(
    text,
    /if (?:you (?:don't|do not|cannot|can't)|(?:the|an?) (?:request|question|input) is) .{0,60}[,;] (?:you should|respond|say|tell|ask|clarify)/i,
    /\bif (?:unclear|unsure|uncertain|ambiguous)\b/i,
    /\bfallback\b/i,
    /\bgraceful(?:ly)? degrad/i,
    /\bif (?:you (?:don't|do not) know|you(?:'re| are) (?:not sure|unsure))\b/i,
    /\bcannot (?:answer|help|assist)\b.*\b(?:instead|then|say|redirect)\b/i,
    /\bwhen (?:you (?:don't|cannot)|the (?:request|question))\b.{0,60}\b(?:respond|say|do)\b/i
  );
  return {
    id: 'failure_contract',
    category: 'Error Handling',
    description: 'Failure / fallback behavior declared',
    severity: 'warning',
    pass,
    finding: pass
      ? 'Failure/fallback contract found.'
      : 'No fallback behavior defined. When the agent cannot fulfill a request, behavior is undefined (Ch 14.3).',
    fix_hint: 'Add: "If you cannot answer, [FALLBACK]. If [FALLBACK] also fails, [TERMINAL BEHAVIOR]." (Failure Contract pattern)'
  };
}

function checkStateScope(text: string): LintCheck {
  // Ch 4.2 — state scope (session vs turn) must be declared when state is tracked
  const hasStateTracking = has(
    text,
    /\btrack\b/i,
    /\bremember\b/i,
    /\bmaintain\b/i,
    /\bkeep track\b/i,
    /\bstate\b/i,
    /\bcontext\b/i
  );
  if (!hasStateTracking) {
    // No state to scope — not applicable, pass trivially
    return {
      id: 'state_scope',
      category: 'State',
      description: 'State scope declared (session vs. turn)',
      severity: 'info',
      pass: true,
      finding: 'No stateful tracking detected — scope check not applicable.',
      fix_hint: 'When tracking state, declare scope: "Track [X] for this session" or "Reset [X] each turn."'
    };
  }
  const pass = has(
    text,
    /\bthis (?:session|conversation|interaction)\b/i,
    /\beach turn\b/i,
    /\bper turn\b/i,
    /\bpersist(?:ent|s|ed)?\b/i,
    /\bsession[- ](?:level|wide|scoped)\b/i,
    /\breset\b.*\b(?:each|every|per) (?:turn|message|request)\b/i,
    /\bthroughout (?:this|the) (?:session|conversation|interaction)\b/i
  );
  return {
    id: 'state_scope',
    category: 'State',
    description: 'State scope declared (session vs. turn)',
    severity: 'warning',
    pass,
    finding: pass
      ? 'State scope (session/turn) declared.'
      : 'State tracking found but scope not declared. Agent may not know when to reset or persist state (Ch 4.2).',
    fix_hint: 'Declare scope explicitly: "Track [X] throughout this session" or "Reset [X] on each new turn."'
  };
}

// ── runner ───────────────────────────────────────────────────────────────────

const ALL_CHECKS = [
  // Identity & Contract
  checkIdentity,
  checkCapabilityBoundary,
  checkConstraintBoundary,
  checkKnowledgeBoundary,
  checkRoleContract,
  // Semantics
  checkNegationRedirect,
  checkPassiveVoice,
  // Control Flow
  checkSequentialSteps,
  checkBlockingGates,
  // Guard Clauses
  checkGuardClauses,
  checkPriorityOrdering,
  // State
  checkStateDeclared,
  checkStateScope,
  // Event Handling
  checkEventHandlers,
  // Error Handling
  checkFailureContract,
  // Output
  checkOutputContract,
  // Security
  checkSecurityProtocol
];

export function lint(prompt: string): LintReport {
  const checks = ALL_CHECKS.map((fn) => fn(prompt));
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  // Weighted penalty: errors=10pts, warnings=5pts, info=2pts
  const errorFails = checks.filter((c) => !c.pass && c.severity === 'error').length;
  const warnFails = checks.filter((c) => !c.pass && c.severity === 'warning').length;
  const infoFails = checks.filter((c) => !c.pass && c.severity === 'info').length;
  const penalty = errorFails * 10 + warnFails * 5 + infoFails * 2;
  const score = Math.max(0, 100 - penalty);
  return { score, passed, failed, checks };
}
