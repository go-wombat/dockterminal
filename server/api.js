import { execSync, execFileSync, spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

export const STACKS_DIR = process.env.VAULTDOCK_STACKS_DIR || path.join(os.homedir(), 'stacks');

// Shell-based runner for system commands that need piping/quoting (non-docker)
export const run = (cmd, timeout = 3000) => {
  try {
    return execSync(cmd, { timeout }).toString().trim();
  } catch {
    return null;
  }
};

// Shell-free runner for docker commands — prevents shell injection
export const runArgs = (bin, args, timeout = 3000) => {
  try {
    return execFileSync(bin, args, { timeout }).toString().trim();
  } catch {
    return null;
  }
};

export function validateId(id) {
  return typeof id === 'string' && /^[a-f0-9]{3,64}$/.test(id);
}

// --- Static system info (called once) ---

export function getSystemInfo() {
  const dockerVersion = runArgs('docker', ['version', '--format', '{{.Server.Version}}']);
  const composeVersion = runArgs('docker', ['compose', 'version', '--short']);
  const hostname = os.hostname();
  const platform = os.platform();
  const release = os.release();

  let hostOs;
  if (platform === 'darwin') {
    const name = run('sw_vers -productName') || 'macOS';
    const ver = run('sw_vers -productVersion') || release;
    hostOs = `${name} ${ver}`;
  } else if (platform === 'linux') {
    const pretty = run('grep PRETTY_NAME /etc/os-release | cut -d= -f2 | tr -d \'"\'');
    hostOs = pretty || `Linux ${release}`;
  } else {
    hostOs = `${platform} ${release}`;
  }

  return {
    hostname,
    hostOs,
    dockerVersion: dockerVersion || 'N/A',
    composeVersion: composeVersion || 'N/A',
  };
}

// --- Dynamic stats (CPU + Memory, polled) ---

let prevCpuTimes = null;

function sampleCpuTimes() {
  const cpus = os.cpus();
  return cpus.map(c => ({
    idle: c.times.idle,
    total: c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq,
  }));
}

function getCpuPercent() {
  const current = sampleCpuTimes();
  if (!prevCpuTimes) {
    prevCpuTimes = current;
    // First call: return load-average-based estimate
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    return Math.min((loadAvg / cpuCount) * 100, 100);
  }

  let totalIdleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < current.length; i++) {
    totalIdleDelta += current[i].idle - prevCpuTimes[i].idle;
    totalDelta += current[i].total - prevCpuTimes[i].total;
  }
  prevCpuTimes = current;

  if (totalDelta === 0) return 0;
  return ((1 - totalIdleDelta / totalDelta) * 100);
}

export function getSystemStats() {
  const cpus = os.cpus();
  const logicalCores = cpus.length;

  // Physical cores
  let physicalCores = logicalCores;
  const platform = os.platform();
  if (platform === 'darwin') {
    const val = run('sysctl -n hw.physicalcpu');
    if (val) physicalCores = parseInt(val, 10);
  } else if (platform === 'linux') {
    const val = run('lscpu -p=CORE | grep -v "^#" | sort -u | wc -l');
    if (val) physicalCores = parseInt(val, 10);
  }

  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const usedMemMb = totalMemMb - freeMemMb;
  const cpuPercent = getCpuPercent();

  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    physicalCores,
    logicalCores,
    totalMemMb,
    usedMemMb,
    loadAvg: os.loadavg().map(v => v.toFixed(2)),
  };
}

// --- Docker container stats ---

export function getDockerStats() {
  const raw = runArgs('docker', ['ps', '-a', '--format', '{{.State}}']);
  if (!raw) return { total: 0, running: 0, stopped: 0 };

  const states = raw.split('\n').filter(Boolean);
  const running = states.filter(s => s === 'running').length;
  return {
    total: states.length,
    running,
    stopped: states.length - running,
  };
}

// --- Docker stacks (compose projects + containers + live stats) ---

function formatUptime(status) {
  // docker ps Status field: "Up 4 days", "Up 2 hours", "Exited (0) 3 days ago"
  if (!status) return '-';
  const up = status.match(/Up\s+(.+?)(?:\s+\(.*\))?$/);
  if (!up) return '-';
  const raw = up[1];
  // Convert "About an hour" -> "1h", "4 days" -> "4d", etc.
  let result = raw
    .replace(/About an hour/i, '1h')
    .replace(/About a minute/i, '1m')
    .replace(/(\d+)\s*seconds?/i, '$1s')
    .replace(/(\d+)\s*minutes?/i, '$1m')
    .replace(/(\d+)\s*hours?/i, '$1h')
    .replace(/(\d+)\s*days?/i, '$1d')
    .replace(/(\d+)\s*weeks?/i, '$1w')
    .replace(/(\d+)\s*months?/i, '$1mo');
  return result.trim();
}

function parsePorts(portsStr) {
  if (!portsStr) return '-';
  // Extract host:container mappings from docker ps Ports field
  const mappings = [];
  const re = /(?:[\d.]+:)?(\d+)->(\d+)/g;
  let m;
  while ((m = re.exec(portsStr)) !== null) {
    mappings.push(`${m[1]}:${m[2]}`);
  }
  return mappings.length > 0 ? [...new Set(mappings)].join(', ') : '-';
}

function parsePercent(str) {
  if (!str) return 0;
  return parseFloat(str.replace('%', '')) || 0;
}

function parseMemMb(memUsage) {
  if (!memUsage) return 0;
  // "38.95MiB / 7.748GiB" or "1.2GiB / 7.748GiB"
  const match = memUsage.match(/([\d.]+)\s*(KiB|MiB|GiB|B)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'gib') return Math.round(val * 1024);
  if (unit === 'mib') return Math.round(val);
  if (unit === 'kib') return Math.round(val / 1024);
  return 0;
}

// --- Managed stacks scanning ---

export function scanManagedStacks() {
  const managed = new Map();
  try {
    if (!fs.existsSync(STACKS_DIR)) return managed;
    const entries = fs.readdirSync(STACKS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(STACKS_DIR, entry.name);
      for (const f of ['compose.yaml', 'compose.yml', 'docker-compose.yml']) {
        const composePath = path.join(dir, f);
        if (fs.existsSync(composePath)) {
          managed.set(entry.name, composePath);
          break;
        }
      }
    }
  } catch {}
  return managed;
}

// Stacks cache (TTL-based to avoid redundant docker CLI calls on every poll)
let stacksCache = null;
let stacksCacheTs = 0;
const STACKS_CACHE_TTL = 2000;

export function getStacks() {
  const now = Date.now();
  if (stacksCache && now - stacksCacheTs < STACKS_CACHE_TTL) {
    return stacksCache;
  }

  // 1. Get compose projects
  const composeLsRaw = runArgs('docker', ['compose', 'ls', '--format', 'json'], 5000);
  let projects = [];
  if (composeLsRaw === null) {
    // Check if Docker daemon is available at all
    const ping = runArgs('docker', ['info'], 3000);
    if (ping === null) {
      return { stacks: [], ts: Date.now(), error: 'Docker daemon not available' };
    }
  } else {
    try {
      projects = JSON.parse(composeLsRaw);
    } catch {
      // Might be line-delimited JSON
      projects = composeLsRaw.split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }
  }

  // 2. Get all containers
  const psRaw = runArgs('docker', ['ps', '-a', '--format', '{{json .}}'], 5000);
  let containers = [];
  if (psRaw) {
    containers = psRaw.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }

  // 3. Get live stats for running containers
  const statsRaw = runArgs('docker', ['stats', '--no-stream', '--format', '{{json .}}'], 10000);
  const statsMap = {};
  if (statsRaw) {
    statsRaw.split('\n').filter(Boolean).forEach(line => {
      try {
        const s = JSON.parse(line);
        statsMap[s.ID] = s;
      } catch {}
    });
  }

  // Group containers by compose project
  const projectContainers = {};
  const standaloneContainers = [];

  for (const c of containers) {
    const project = c.Labels?.match(/com\.docker\.compose\.project=([^,]+)/)?.[1];
    if (project) {
      if (!projectContainers[project]) projectContainers[project] = [];
      projectContainers[project].push(c);
    } else {
      standaloneContainers.push(c);
    }
  }

  // Scan managed stacks from STACKS_DIR
  const managedNames = scanManagedStacks();

  // Build stacks from compose projects
  const activeProjectNames = new Set();
  const stacks = projects.map(p => {
    const name = p.Name;
    const composePath = p.ConfigFiles || '';
    const isManaged = managedNames.has(name);
    activeProjectNames.add(name);
    const pContainers = projectContainers[name] || [];

    const mapped = pContainers.map(c => {
      const shortId = (c.ID || '').slice(0, 12);
      const stat = statsMap[shortId] || statsMap[c.ID] || {};
      const state = (c.State || 'unknown').toLowerCase();
      const statusField = c.Status || '';

      // Health from status field
      let health = '-';
      if (state === 'running') {
        if (statusField.includes('(healthy)')) health = 'healthy';
        else if (statusField.includes('(unhealthy)')) health = 'unhealthy';
        else health = 'running';
      }

      return {
        id: shortId,
        name: (c.Names || '').replace(/^\//, ''),
        image: c.Image || '',
        status: state,
        cpu: parsePercent(stat.CPUPerc),
        mem: parsePercent(stat.MemPerc),
        memMb: parseMemMb(stat.MemUsage),
        uptime: formatUptime(statusField),
        ports: parsePorts(c.Ports),
        health,
        managed: isManaged,
      };
    });

    // Determine stack status
    const running = mapped.filter(c => c.status === 'running').length;
    let status;
    if (running === mapped.length && mapped.length > 0) status = 'running';
    else if (running === 0) status = 'stopped';
    else status = 'partial';

    return { name, path: composePath, status, containers: mapped, managed: isManaged };
  });

  // Add managed stacks from STACKS_DIR that aren't running (not in docker compose ls)
  for (const [name, composePath] of managedNames) {
    if (!activeProjectNames.has(name)) {
      stacks.push({ name, path: composePath, status: 'created', containers: [], managed: true });
    }
  }

  // Add standalone containers as a group
  if (standaloneContainers.length > 0) {
    const mapped = standaloneContainers.map(c => {
      const shortId = (c.ID || '').slice(0, 12);
      const stat = statsMap[shortId] || statsMap[c.ID] || {};
      const state = (c.State || 'unknown').toLowerCase();
      const statusField = c.Status || '';
      let health = '-';
      if (state === 'running') {
        if (statusField.includes('(healthy)')) health = 'healthy';
        else if (statusField.includes('(unhealthy)')) health = 'unhealthy';
        else health = 'running';
      }
      return {
        id: shortId,
        name: (c.Names || '').replace(/^\//, ''),
        image: c.Image || '',
        status: state,
        cpu: parsePercent(stat.CPUPerc),
        mem: parsePercent(stat.MemPerc),
        memMb: parseMemMb(stat.MemUsage),
        uptime: formatUptime(statusField),
        ports: parsePorts(c.Ports),
        health,
        managed: false,
      };
    });
    const running = mapped.filter(c => c.status === 'running').length;
    let status;
    if (running === mapped.length) status = 'running';
    else if (running === 0) status = 'stopped';
    else status = 'partial';
    stacks.push({ name: 'standalone', path: '', status, containers: mapped, managed: false });
  }

  // Sort: managed first, then unmanaged, standalone always last
  stacks.sort((a, b) => {
    if (a.name === 'standalone') return 1;
    if (b.name === 'standalone') return -1;
    if (a.managed === b.managed) return a.name.localeCompare(b.name);
    return a.managed ? -1 : 1;
  });

  const result = { stacks, ts: Date.now() };
  stacksCache = result;
  stacksCacheTs = Date.now();
  return result;
}

// --- Container inspect ---

export const FILTERED_ENV_PREFIXES = ['PATH=', 'HOSTNAME=', 'HOME=', 'TERM=', 'SHLVL=', 'PWD='];

export function getContainerInspect(containerId) {
  if (!validateId(containerId)) return null;

  const raw = runArgs('docker', ['inspect', containerId], 5000);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw)[0];
    if (!data) return null;

    // Filter env vars
    const allEnv = (data.Config?.Env || []).map(e => {
      const idx = e.indexOf('=');
      return idx > -1 ? [e.slice(0, idx), e.slice(idx + 1)] : [e, ''];
    });
    const env = allEnv.filter(([k]) =>
      !FILTERED_ENV_PREFIXES.some(p => (k + '=').startsWith(p))
    );

    // Mounts
    const mounts = (data.Mounts || []).map(m => ({
      source: m.Source || '',
      destination: m.Destination || '',
      mode: m.Mode || 'rw',
      type: m.Type || 'bind',
    }));

    // Ports
    const ports = data.NetworkSettings?.Ports || {};

    // Networks
    const networks = {};
    const nets = data.NetworkSettings?.Networks || {};
    for (const [name, net] of Object.entries(nets)) {
      networks[name] = {
        IPAddress: net.IPAddress || '',
        Gateway: net.Gateway || '',
      };
    }

    return {
      env,
      mounts,
      ports,
      networks,
      restartPolicy: data.HostConfig?.RestartPolicy || {},
      state: {
        OOMKilled: data.State?.OOMKilled || false,
        ExitCode: data.State?.ExitCode ?? 0,
        Error: data.State?.Error || '',
        StartedAt: data.State?.StartedAt || '',
        FinishedAt: data.State?.FinishedAt || '',
        Status: data.State?.Status || '',
      },
      config: {
        Image: data.Config?.Image || '',
        Cmd: data.Config?.Cmd || [],
        WorkingDir: data.Config?.WorkingDir || '',
      },
    };
  } catch {
    return null;
  }
}

// --- Container logs ---

export function getContainerLogs(containerId, tail = 100) {
  if (!validateId(containerId)) return { logs: [] };

  // Use spawnSync to capture both stdout and stderr (docker sends logs to both)
  let raw;
  try {
    const result = spawnSync('docker', ['logs', '--tail', String(tail), '--timestamps', containerId], {
      timeout: 5000,
      encoding: 'utf8',
    });
    raw = ((result.stdout || '') + (result.stderr || '')).trim();
  } catch {
    return { logs: [] };
  }
  if (!raw) return { logs: [] };

  const logs = raw.split('\n').filter(Boolean).map(line => {
    // Timestamp format: 2024-01-15T14:23:01.123456789Z
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*(.*)/);
    let time, msg;
    if (tsMatch) {
      try {
        const d = new Date(tsMatch[1]);
        time = d.toLocaleTimeString('en-GB', { hour12: false });
      } catch {
        time = tsMatch[1].slice(11, 19);
      }
      msg = tsMatch[2];
    } else {
      time = new Date().toLocaleTimeString('en-GB', { hour12: false });
      msg = line;
    }

    // Determine level
    let level = 'INFO';
    const lower = msg.toLowerCase();
    if (/error|fatal|panic|exception|failed/i.test(lower)) level = 'ERR';
    else if (/warn|warning/i.test(lower)) level = 'WARN';

    return { time, level, source: containerId.slice(0, 8), msg };
  });

  return { logs };
}

// --- Docker events ---

export function getDockerEvents() {
  const raw = runArgs('docker', ['events', '--since', '5m', '--until', 'now', '--format', '{{json .}}'], 10000);
  if (!raw) return { events: [] };

  const events = raw.split('\n').filter(Boolean).map(line => {
    try {
      const e = JSON.parse(line);
      const ts = e.time ? new Date(e.time * 1000) : new Date();
      const time = ts.toLocaleTimeString('en-GB', { hour12: false });
      const name = e.Actor?.Attributes?.name || e.Actor?.ID?.slice(0, 12) || 'unknown';
      const action = e.Action || '';
      const type = e.Type || '';

      let level = 'INFO';
      let msg = `${type} ${action}: ${name}`;

      if (action === 'die') {
        const exitCode = e.Actor?.Attributes?.exitCode || '?';
        level = 'ERR';
        msg = `Container ${name} died (exit code ${exitCode})`;
      } else if (action === 'stop') {
        level = 'WARN';
        msg = `Container ${name} stopped`;
      } else if (action === 'start') {
        msg = `Container ${name} started`;
      } else if (action === 'restart') {
        msg = `Container ${name} restarted`;
      } else if (action === 'kill') {
        level = 'WARN';
        msg = `Container ${name} killed`;
      } else if (action.startsWith('health_status')) {
        const health = action.includes('unhealthy') ? 'unhealthy' : 'healthy';
        level = health === 'unhealthy' ? 'WARN' : 'INFO';
        msg = `Container ${name} health: ${health}`;
      }

      return { time, level, source: name, msg };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return { events };
}

// --- Container exec ---

export const BLOCKED_COMMANDS = [
  /rm\s+(-rf?|--recursive)\s+\//,
  /shutdown/,
  /reboot/,
  /mkfs/,
  /dd\s+if=/,
  /:(){ :\|:& };:/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /mv\s+\/\s/,
];

export function execInContainer(containerId, command) {
  if (!validateId(containerId)) {
    return { stdout: '', stderr: 'Invalid container ID', exitCode: 1 };
  }
  if (!command || typeof command !== 'string') {
    return { stdout: '', stderr: 'No command provided', exitCode: 1 };
  }
  if (BLOCKED_COMMANDS.some(re => re.test(command))) {
    return { stdout: '', stderr: 'Command blocked for safety', exitCode: 126 };
  }

  // command is passed as a single argument to sh -c inside the container,
  // not through host shell interpolation (execFileSync bypasses sh)
  try {
    const stdout = execFileSync(
      'docker', ['exec', containerId, 'sh', '-c', command],
      { timeout: 10000 }
    ).toString();
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message,
      exitCode: err.status ?? 1,
    };
  }
}

// --- Container action ---

export function containerAction(containerId, action) {
  if (!validateId(containerId)) {
    return { error: 'Invalid container ID' };
  }

  const actions = {
    restart: ['restart'],
    stop: ['stop'],
    start: ['start'],
    remove: ['rm', '-f'],
  };

  const args = actions[action];
  if (!args) return { error: `Unknown action: ${action}` };

  try {
    execFileSync('docker', [...args, containerId], { timeout: 30000 });
    return { ok: true };
  } catch (err) {
    return { error: err.stderr?.toString() || err.message };
  }
}

// --- Stack (compose) action ---

export function stackAction(stackName, action) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(stackName)) {
    return { error: 'Invalid stack name' };
  }

  const validActions = { up: true, down: true, restart: true, stop: true };
  if (!validActions[action]) {
    return { error: `Unknown action: ${action}` };
  }

  // Find compose file path: check cached stacks first, then scan STACKS_DIR
  let composePath = null;
  if (stacksCache) {
    const cached = stacksCache.stacks.find(s => s.name === stackName);
    if (cached?.path) composePath = cached.path;
  }
  if (!composePath) {
    const managed = scanManagedStacks();
    composePath = managed.get(stackName);
  }
  if (!composePath) {
    return { error: `Compose file not found for stack: ${stackName}` };
  }

  const actionArgs = {
    up:      ['compose', '-f', composePath, 'up', '-d', '--remove-orphans'],
    down:    ['compose', '-f', composePath, 'down'],
    restart: ['compose', '-f', composePath, 'restart'],
    stop:    ['compose', '-f', composePath, 'stop'],
  };

  try {
    execFileSync('docker', actionArgs[action], { timeout: 60000 });
    stacksCache = null;
    return { ok: true };
  } catch (err) {
    return { error: err.stderr?.toString() || err.message };
  }
}

// --- Bulk stack operations ---

export function restartAllStacks() {
  const managed = scanManagedStacks();
  const results = [];
  for (const [name, composePath] of managed) {
    try {
      execFileSync('docker', ['compose', '-f', composePath, 'restart'], { timeout: 60000 });
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, error: err.stderr?.toString() || err.message });
    }
  }
  stacksCache = null;
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    return { ok: true, warning: `${failed.length} stack(s) failed to restart: ${failed.map(f => f.name).join(', ')}` };
  }
  return { ok: true, restarted: results.length };
}

export function pullAllImages() {
  const managed = scanManagedStacks();
  const results = [];
  for (const [name, composePath] of managed) {
    try {
      execFileSync('docker', ['compose', '-f', composePath, 'pull'], { timeout: 120000 });
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, error: err.stderr?.toString() || err.message });
    }
  }
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    return { ok: true, warning: `${failed.length} stack(s) failed to pull: ${failed.map(f => f.name).join(', ')}` };
  }
  return { ok: true, pulled: results.length };
}

export function dockerPrune() {
  try {
    const output = execFileSync('docker', ['system', 'prune', '-f'], { timeout: 60000 }).toString();
    stacksCache = null;
    return { ok: true, output };
  } catch (err) {
    return { error: err.stderr?.toString() || err.message };
  }
}

// --- Create stack ---

export function createStack(name, yaml, deploy = false) {
  if (!name || typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name) || name.length > 64) {
    return { error: 'Invalid stack name. Use lowercase letters, numbers, and hyphens (max 64 chars).' };
  }
  if (!yaml || typeof yaml !== 'string' || yaml.trim().length === 0) {
    return { error: 'Compose YAML content is required.' };
  }

  const stackDir = path.join(STACKS_DIR, name);
  if (fs.existsSync(stackDir)) {
    return { error: `Stack "${name}" already exists.` };
  }

  try {
    fs.mkdirSync(STACKS_DIR, { recursive: true });
    fs.mkdirSync(stackDir);
    const composePath = path.join(stackDir, 'compose.yaml');
    fs.writeFileSync(composePath, yaml, 'utf8');
    stacksCache = null;

    if (deploy) {
      try {
        execFileSync('docker', ['compose', '-f', composePath, 'up', '-d', '--remove-orphans'], { timeout: 60000 });
        return { ok: true, deployed: true, path: composePath };
      } catch (err) {
        return { ok: true, deployed: false, path: composePath, warning: err.stderr?.toString() || err.message };
      }
    }

    return { ok: true, deployed: false, path: composePath };
  } catch (err) {
    return { error: err.message };
  }
}
