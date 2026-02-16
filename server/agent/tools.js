// Tool definitions (schemas for LLM) and executors (Docker CLI calls).
import { execFileSync, spawnSync } from 'child_process';
import { validateId, runArgs } from '../api.js';
import { validateCommand } from './safety.js';

const TOOL_RESULT_MAX = 8000;

function truncate(str, max = TOOL_RESULT_MAX) {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n... (truncated, ${str.length} chars total)`;
}

// --- Tool schemas (provider-agnostic, converted per provider) ---

export const TOOL_SCHEMAS = [
  {
    name: 'get_container_logs',
    description: 'Read recent logs from a container. Returns timestamped log lines.',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
        tail: { type: 'number', description: 'Number of recent lines (default 100, max 500)' },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'get_container_inspect',
    description: 'Get detailed container info: state, config, mounts, networks, exit code, health, restart policy.',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'get_container_top',
    description: 'List processes running inside a container (only works on running containers).',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'get_container_diff',
    description: 'Show filesystem changes made inside the container since it started.',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'get_container_events',
    description: 'Get recent Docker engine events for a specific container (last 10 minutes).',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'get_container_health_log',
    description: 'Get health check results from the container (if health check is configured).',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'exec_in_container',
    description: 'Run a safe read-only command inside the container. Only whitelisted binaries allowed (cat, ls, df, ps, grep, etc). No writes or destructive commands.',
    parameters: {
      type: 'object',
      properties: {
        container_id: { type: 'string', description: '12-char hex container ID' },
        command: { type: 'string', description: 'Shell command to execute (read-only only)' },
      },
      required: ['container_id', 'command'],
    },
  },
  {
    name: 'exec_on_host',
    description: 'Run a safe read-only command on the Docker host. Only whitelisted binaries allowed (df, free, ps, ss, ip, cat, etc). Useful for checking disk space, memory, processes, ports, DNS config.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute on host (read-only only)' },
      },
      required: ['command'],
    },
  },
];

// --- Tool executors ---

function execGetContainerLogs({ container_id, tail }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const n = Math.min(Math.max(parseInt(tail) || 100, 1), 500);
  // Docker sends logs to both stdout and stderr — use spawnSync to capture both
  try {
    const proc = spawnSync('docker', ['logs', '--tail', String(n), '--timestamps', container_id], {
      timeout: 10000,
      encoding: 'utf8',
    });
    const combined = ((proc.stdout || '') + (proc.stderr || '')).trim();
    if (!combined) return { output: '(no logs)' };
    return { output: truncate(combined) };
  } catch {
    return { error: 'Failed to get logs (container may not exist)' };
  }
}

function execGetContainerInspect({ container_id }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const result = runArgs('docker', ['inspect', container_id], 5000);
  if (result === null) return { error: 'Failed to inspect container' };
  return { output: truncate(result) };
}

function execGetContainerTop({ container_id }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const result = runArgs('docker', ['top', container_id], 5000);
  if (result === null) return { error: 'Failed to get process list (container may not be running)' };
  return { output: truncate(result) };
}

function execGetContainerDiff({ container_id }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const result = runArgs('docker', ['diff', container_id], 5000);
  if (result === null) return { error: 'Failed to get filesystem diff' };
  return { output: result ? truncate(result) : '(no filesystem changes)' };
}

function execGetContainerEvents({ container_id }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const result = runArgs('docker', [
    'events', '--filter', `container=${container_id}`,
    '--since', '10m', '--until', 'now',
    '--format', '{{.Time}} {{.Action}} {{.Actor.Attributes.exitCode}}'
  ], 10000);
  if (result === null) return { output: '(no recent events)' };
  return { output: result ? truncate(result) : '(no recent events)' };
}

function execGetContainerHealthLog({ container_id }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const result = runArgs('docker', [
    'inspect', '--format', '{{json .State.Health}}', container_id
  ], 5000);
  if (result === null || result === '<nil>' || result === 'null') {
    return { output: '(no health check configured)' };
  }
  return { output: truncate(result) };
}

function execInContainerSafe({ container_id, command }) {
  if (!validateId(container_id)) return { error: 'Invalid container ID' };
  const check = validateCommand(command);
  if (!check.ok) return { error: `Command blocked: ${check.reason}` };

  try {
    const stdout = execFileSync(
      'docker', ['exec', container_id, 'sh', '-c', command],
      { timeout: 10000 }
    ).toString();
    return { output: truncate(stdout) };
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message;
    return { output: truncate(err.stdout?.toString() || ''), error: truncate(stderr) };
  }
}

function execOnHostSafe({ command }) {
  const check = validateCommand(command);
  if (!check.ok) return { error: `Command blocked: ${check.reason}` };

  try {
    const stdout = execFileSync(
      'sh', ['-c', command],
      { timeout: 10000 }
    ).toString();
    return { output: truncate(stdout) };
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message;
    return { output: truncate(err.stdout?.toString() || ''), error: truncate(stderr) };
  }
}

const EXECUTORS = {
  get_container_logs: execGetContainerLogs,
  get_container_inspect: execGetContainerInspect,
  get_container_top: execGetContainerTop,
  get_container_diff: execGetContainerDiff,
  get_container_events: execGetContainerEvents,
  get_container_health_log: execGetContainerHealthLog,
  exec_in_container: execInContainerSafe,
  exec_on_host: execOnHostSafe,
};

/**
 * Execute a tool by name with given arguments.
 * Returns { result: string } or { error: string }.
 */
export function executeTool(name, args) {
  const executor = EXECUTORS[name];
  if (!executor) return { error: `Unknown tool: ${name}` };

  try {
    const result = executor(args);
    if (result.error && result.output) {
      return { result: `${result.output}\n\nSTDERR: ${result.error}` };
    }
    if (result.error) return { error: result.error };
    return { result: result.output || '(empty output)' };
  } catch (err) {
    return { error: `Tool execution failed: ${err.message}` };
  }
}

/**
 * Check if a tool name is an exec tool (counts toward exec limit).
 */
export function isExecTool(name) {
  return name === 'exec_in_container' || name === 'exec_on_host';
}
