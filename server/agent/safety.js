// Command safety layer for agent exec tools.
// Both exec_in_container and exec_on_host share the same rules.

const ALLOWED_BINARIES = new Set([
  'cat', 'ls', 'df', 'ps', 'whoami', 'env', 'printenv', 'mount',
  'ip', 'ss', 'ping', 'nslookup', 'dig', 'head', 'tail', 'wc',
  'find', 'stat', 'file', 'uname', 'date', 'uptime', 'free', 'id',
  'hostname', 'netstat', 'grep', 'awk', 'sort', 'uniq', 'cut',
  'echo', 'which', 'curl', 'top', 'du', 'lsof', 'getent',
]);

const BLOCKED_PATTERNS = [
  /\brm\b/,
  /\bkill\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bmkfs\b/,
  /\bdd\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bmv\b/,
  /\bcp\b/,
  />+/,              // redirects
  /\bapt\b/,
  /\byum\b/,
  /\bapk\b/,
  /\bpip\b/,
  /\bnpm\b/,
  /\bwget\b/,
  /\bpython\b/,
  /\bnode\b/,
  /\bruby\b/,
  /\bperl\b/,
  /\bbash\s+-c\b/,
  /\bsh\s+-c\b/,
  /\bsudo\b/,
  /\bsu\b/,
  /\btee\b/,
  /\bsed\b.*-i/,     // in-place sed
  /\bmkdir\b/,
  /\btouch\b/,
];

/**
 * Validate a command string for safe read-only execution.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    return { ok: false, reason: 'Empty command' };
  }

  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Empty command' };
  }
  if (trimmed.length > 2000) {
    return { ok: false, reason: 'Command too long (max 2000 chars)' };
  }

  // Check blocked patterns on the full command
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: `Blocked pattern: ${pattern.source}` };
    }
  }

  // Split by pipes and check each segment's first token
  const segments = trimmed.split(/\|/).map(s => s.trim()).filter(Boolean);
  for (const segment of segments) {
    // Extract the binary name (first token, ignoring env-style VAR=val prefixes)
    const tokens = segment.split(/\s+/);
    let binary = null;
    for (const token of tokens) {
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) continue; // env var
      binary = token.replace(/^.*\//, ''); // strip path prefix
      break;
    }
    if (!binary) {
      return { ok: false, reason: `Could not determine binary in: ${segment}` };
    }
    if (!ALLOWED_BINARIES.has(binary)) {
      return { ok: false, reason: `Binary not allowed: ${binary}` };
    }
  }

  return { ok: true };
}
