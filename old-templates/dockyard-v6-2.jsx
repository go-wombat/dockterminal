import { useState, useEffect, useRef } from "react";

const MOCK_STACKS = [
  {
    name: "web-platform", path: "/opt/stacks/web-platform", status: "running",
    containers: [
      { id: "a1b2c3d4", name: "nginx-proxy", image: "nginx:alpine", status: "running", cpu: 2.3, mem: 18, memMb: 128, uptime: "4d 12h 33m", ports: "80:80, 443:443", health: "healthy" },
      { id: "y5z6a7b8", name: "web-app-frontend", image: "node:20-slim", status: "running", cpu: 1.1, mem: 12, memMb: 156, uptime: "4d 12h 33m", ports: "3000:3000", health: "healthy" },
      { id: "b8c9d0e1", name: "api-backend", image: "python:3.12-slim", status: "running", cpu: 4.2, mem: 24, memMb: 310, uptime: "4d 12h 33m", ports: "8080:8080", health: "healthy" },
      { id: "e5f6g7h8", name: "postgres-main", image: "postgres:16", status: "running", cpu: 8.7, mem: 62, memMb: 512, uptime: "4d 12h 33m", ports: "5432:5432", health: "healthy" },
      { id: "i9j0k1l2", name: "redis-cache", image: "redis:7-alpine", status: "running", cpu: 0.8, mem: 8, memMb: 64, uptime: "4d 12h 31m", ports: "6379:6379", health: "healthy" },
    ],
  },
  {
    name: "scrapers", path: "/opt/stacks/scrapers", status: "partial",
    containers: [
      { id: "m3n4o5p6", name: "scraper-worker-1", image: "gowombat/scraper:latest", status: "running", cpu: 34.2, mem: 78, memMb: 890, uptime: "2h 14m", ports: "-", health: "healthy" },
      { id: "q7r8s9t0", name: "scraper-worker-2", image: "gowombat/scraper:latest", status: "exited", cpu: 0, mem: 0, memMb: 0, uptime: "-", ports: "-", health: "FAULT", error: "OOMKilled — exceeded 1024MB memory limit. Last log: 'Processing batch 847/2000 — memory allocation failed for DOM parser.' Suggested fix: increase memory limit to 2048MB or reduce batch concurrency." },
      { id: "f2g3h4i5", name: "scraper-db", image: "postgres:16", status: "running", cpu: 3.1, mem: 32, memMb: 256, uptime: "2h 14m", ports: "5433:5432", health: "healthy" },
      { id: "j6k7l8m9", name: "scraper-queue", image: "rabbitmq:3-mgmt", status: "running", cpu: 1.4, mem: 14, memMb: 178, uptime: "2h 14m", ports: "5672:5672, 15672:15672", health: "healthy" },
    ],
  },
  {
    name: "etl-pipeline", path: "/opt/stacks/etl", status: "running",
    containers: [
      { id: "u1v2w3x4", name: "etl-worker", image: "gowombat/etl:2.1", status: "running", cpu: 15.6, mem: 45, memMb: 384, uptime: "1d 3h", ports: "-", health: "healthy" },
      { id: "n0o1p2q3", name: "etl-scheduler", image: "gowombat/etl-cron:1.0", status: "running", cpu: 0.2, mem: 4, memMb: 48, uptime: "1d 3h", ports: "-", health: "healthy" },
    ],
  },
  {
    name: "monitoring", path: "/opt/stacks/monitoring", status: "running",
    containers: [
      { id: "k7l8m9n0", name: "uptime-kuma", image: "louislam/uptime-kuma:1", status: "running", cpu: 1.8, mem: 22, memMb: 186, uptime: "4d 12h 30m", ports: "3001:3001", health: "healthy" },
      { id: "g3h4i5j6", name: "watchtower", image: "containrrr/watchtower", status: "running", cpu: 0.1, mem: 3, memMb: 18, uptime: "4d 12h 33m", ports: "-", health: "healthy" },
    ],
  },
  {
    name: "simplelogin", path: "/opt/stacks/simplelogin", status: "stopped",
    containers: [
      { id: "r4s5t6u7", name: "sl-app", image: "simplelogin/app:4.6", status: "exited", cpu: 0, mem: 0, memMb: 0, uptime: "-", ports: "-", health: "-" },
      { id: "v8w9x0y1", name: "sl-email", image: "simplelogin/postfix:4.6", status: "exited", cpu: 0, mem: 0, memMb: 0, uptime: "-", ports: "-", health: "-" },
      { id: "z2a3b4c5", name: "sl-db", image: "postgres:14", status: "exited", cpu: 0, mem: 0, memMb: 0, uptime: "-", ports: "-", health: "-" },
    ],
  },
];

const MOCK_CONTAINERS = MOCK_STACKS.flatMap(s => s.containers);

const MOCK_LOGS = [
  { time: "14:23:01", level: "INFO", source: "SYSTEM", msg: "Container health check cycle completed — 13/16 operational" },
  { time: "14:22:58", level: "ERR", source: "scrapers/worker-2", msg: "FATAL: OOMKilled — container exceeded memory limit (1024MB)" },
  { time: "14:22:58", level: "WARN", source: "AI-AGENT", msg: "Analyzing failure for scraper-worker-2... Root cause: memory exhaustion during DOM parsing of large pages" },
  { time: "14:22:45", level: "INFO", source: "scrapers/worker-1", msg: "Batch 203/500 completed — 1,247 records extracted" },
  { time: "14:22:30", level: "INFO", source: "etl/etl-worker", msg: "Transform stage: processing 12,847 records from staging" },
  { time: "14:21:15", level: "WARN", source: "web/postgres-main", msg: "Connection pool at 78% capacity (156/200 connections)" },
  { time: "14:20:02", level: "INFO", source: "mon/watchtower", msg: "Checking for image updates... all images up to date" },
  { time: "14:19:44", level: "INFO", source: "web/nginx-proxy", msg: "GET /api/v1/health 200 — 2ms" },
  { time: "14:18:30", level: "INFO", source: "mon/uptime-kuma", msg: "All 14 monitors operational — avg response 43ms" },
  { time: "14:17:00", level: "INFO", source: "SYSTEM", msg: "Disk usage: 47% (234GB/500GB) — Volume cleanup not required" },
  { time: "14:16:22", level: "ERR", source: "etl/etl-worker", msg: "Failed to parse row 4,231 — invalid UTF-8 sequence in field 'description'" },
  { time: "14:15:10", level: "WARN", source: "web/redis-cache", msg: "Memory usage approaching maxmemory limit (58MB/64MB)" },
  { time: "14:14:55", level: "INFO", source: "web/nginx-proxy", msg: "POST /api/v1/scrape 201 — 142ms" },
  { time: "14:14:01", level: "INFO", source: "scrapers/worker-1", msg: "Batch 202/500 completed — 1,193 records extracted" },
  { time: "14:13:30", level: "ERR", source: "web/frontend", msg: "Unhandled promise rejection: TypeError: Cannot read property 'map' of undefined at Dashboard.jsx:47" },
  { time: "14:12:44", level: "WARN", source: "web/postgres-main", msg: "Slow query detected: SELECT * FROM events WHERE... (3,412ms)" },
  { time: "14:11:00", level: "INFO", source: "SYSTEM", msg: "Automatic backup initiated — target: /mnt/backups/2026-02-14/" },
];

const AI_ANALYSIS = {
  title: "CONTAINER FAILURE ANALYSIS",
  container: "scraper-worker-2",
  timestamp: "2026-02-14 14:22:58",
  diagnosis: [
    "Container terminated with OOMKilled signal",
    "Memory usage spiked to 1024MB limit during batch 847/2000",
    "DOM parser attempted allocation for page with 14,000+ nodes",
    "Similar pattern observed 3 times in last 7 days",
  ],
  suggestion: "Increase memory_limit to 2048m in compose.yaml or set BATCH_CONCURRENCY=2 (currently 4)",
  confidence: 94,
  autofix: "docker compose -f /opt/stacks/scrapers/compose.yaml up -d --force-recreate scraper-worker-2",
};

const MOCK_SHELL_HISTORY = [
  { type: "input", text: "ls -la /app" },
  { type: "output", text: `total 48
drwxr-xr-x  8 node node 4096 Feb 14 10:22 .
drwxr-xr-x  1 root root 4096 Feb 14 08:00 ..
-rw-r--r--  1 node node  847 Feb 13 15:30 package.json
-rw-r--r--  1 node node  234 Feb 13 15:30 .env
drwxr-xr-x 42 node node 4096 Feb 14 08:01 node_modules
drwxr-xr-x  4 node node 4096 Feb 13 15:30 src
drwxr-xr-x  2 node node 4096 Feb 14 10:22 logs
-rw-r--r--  1 node node 1247 Feb 14 10:22 error.log` },
  { type: "input", text: "cat .env" },
  { type: "output", text: `NODE_ENV=production
DB_HOST=postgres-main
DB_PORT=5432
REDIS_URL=redis://redis-cache:6379
BATCH_CONCURRENCY=4
MAX_MEMORY=1024` },
  { type: "input", text: "tail -5 error.log" },
  { type: "output", text: `[14:22:55] Processing batch 845/2000 — memory: 891MB
[14:22:56] Processing batch 846/2000 — memory: 948MB
[14:22:57] Processing batch 847/2000 — memory: 1019MB
[14:22:58] FATAL: memory allocation failed for DOM parser
[14:22:58] Process killed by OOM handler` },
];

function CRTOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1000 }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
      }} />
    </div>
  );
}

function GlitchText({ children, style = {} }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.03) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 80 + Math.random() * 120);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <span style={{
      ...style,
      display: "inline-block",
      transform: glitch ? `translate(${Math.random() * 3 - 1}px, ${Math.random() * 2 - 1}px)` : "none",
      opacity: glitch ? 0.7 : 1,
      textShadow: glitch ? "2px 0 #00ff41, -2px 0 #00ff41" : style.textShadow || "none",
    }}>
      {children}
    </span>
  );
}

function ProgressBar({ value, max = 100, danger = false }) {
  const pct = Math.min(value / max * 100, 100);
  const c = danger ? "#ff3333" : pct > 75 ? "#ffaa00" : "#00ff41";
  const blocks = Math.floor(pct / 5);
  const bar = "█".repeat(blocks) + "░".repeat(20 - blocks);
  return (
    <span style={{ color: c, fontFamily: "monospace", fontSize: 11, letterSpacing: -0.5 }}>
      [{bar}] {value.toFixed(1)}%
    </span>
  );
}

function ShellTerminal({ container, onClose }) {
  const [history, setHistory] = useState(MOCK_SHELL_HISTORY);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    if (e.key !== "Enter" || !input.trim()) return;
    const cmd = input.trim();
    const newHistory = [...history, { type: "input", text: cmd }];

    if (cmd === "exit") {
      onClose();
      return;
    }

    const responses = {
      "whoami": "node",
      "pwd": "/app",
      "hostname": container.id.slice(0, 12),
      "ps aux": `USER  PID %CPU %MEM    VSZ   RSS TTY  STAT START TIME COMMAND\nnode    1  ${container.cpu}  ${container.mem} 984320 ${container.memMb * 1024} ?  Ssl  08:00 2:34 node /app/server.js\nnode   47  0.0  0.0  18228  3340 pts/0 Ss   14:23 0:00 /bin/sh\nnode   58  0.0  0.0  36640  2840 pts/0 R+   14:23 0:00 ps aux`,
      "free -m": `              total    used    free   shared  buff/cache  available\nMem:          32768   ${container.memMb}   ${32768 - container.memMb - 4096}    128     4096      ${32768 - container.memMb}\nSwap:          8192      0     8192`,
      "env | head -5": `NODE_ENV=production\nDB_HOST=postgres-main\nDB_PORT=5432\nREDIS_URL=redis://redis-cache:6379\nHOSTNAME=${container.id.slice(0, 12)}`,
      "df -h": `Filesystem  Size  Used  Avail Use% Mounted on\noverlay     500G  234G  266G  47%  /\ntmpfs        64M    0   64M   0%  /dev\n/dev/sda1   500G  234G  266G  47%  /app`,
    };

    const output = responses[cmd] || `sh: ${cmd.split(" ")[0]}: command not found`;
    newHistory.push({ type: "output", text: output });
    setHistory(newHistory);
    setInput("");
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 900,
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "75vw",
        height: "70vh",
        background: "#080c08",
        border: "1px solid #00ff41",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 0 40px rgba(0,255,65,0.15), inset 0 0 40px rgba(0,255,65,0.02)",
      }}>
        {/* Shell Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid #004d14",
          background: "rgba(0,255,65,0.03)",
        }}>
          <div style={{ fontSize: 12, color: "#00ff41" }}>
            SHELL — {container.name} ({container.id.slice(0, 12)}) — /bin/sh
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#007a22" }}>type 'exit' or press ESC to close</span>
            <div
              onClick={onClose}
              style={{
                color: "#ff3333",
                cursor: "pointer",
                fontSize: 14,
                padding: "0 4px",
                lineHeight: 1,
              }}
              onMouseEnter={e => e.currentTarget.style.textShadow = "0 0 8px rgba(255,51,51,0.8)"}
              onMouseLeave={e => e.currentTarget.style.textShadow = "none"}
            >
              ✕
            </div>
          </div>
        </div>

        {/* Shell Output */}
        <div ref={scrollRef} style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 16px",
          fontSize: 13,
          lineHeight: 1.5,
        }}
          onClick={() => inputRef.current?.focus()}
        >
          <div style={{ color: "#007a22", marginBottom: 8 }}>
            Connected to {container.name} ({container.image}){"\n"}
            Type commands below. This is a simulated shell for demo purposes.{"\n"}
            ─────────────────────────────────────────
          </div>
          {history.map((entry, i) => (
            <div key={i} style={{ marginBottom: entry.type === "output" ? 8 : 0 }}>
              {entry.type === "input" ? (
                <div>
                  <span style={{ color: "#00aa30" }}>root@{container.id.slice(0, 8)}</span>
                  <span style={{ color: "#007a22" }}>:</span>
                  <span style={{ color: "#4488ff" }}>/app</span>
                  <span style={{ color: "#007a22" }}>$ </span>
                  <span style={{ color: "#00ff41" }}>{entry.text}</span>
                </div>
              ) : (
                <pre style={{
                  color: "#00cc38",
                  margin: 0,
                  fontFamily: "inherit",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}>{entry.text}</pre>
              )}
            </div>
          ))}

          {/* Input Line */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ color: "#00aa30" }}>root@{container.id.slice(0, 8)}</span>
            <span style={{ color: "#007a22" }}>:</span>
            <span style={{ color: "#4488ff" }}>/app</span>
            <span style={{ color: "#007a22" }}>$ </span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                handleSubmit(e);
                if (e.key === "Escape") onClose();
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#00ff41",
                fontFamily: "inherit",
                fontSize: 13,
                caretColor: "#00ff41",
                padding: 0,
                margin: 0,
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContainerRow({ container, selected, onClick, indent }) {
  const statusColor = container.status === "running" ? "#00ff41" : "#ff3333";
  const statusIcon = container.status === "running" ? "●" : "✖";
  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr 140px 80px 140px 100px 70px",
        gap: 8,
        padding: indent ? "5px 12px 5px 32px" : "6px 12px",
        cursor: "pointer",
        background: selected ? "rgba(0,255,65,0.1)" : container.error ? "rgba(255,51,51,0.03)" : "transparent",
        borderLeft: selected ? "2px solid #00ff41" : "2px solid transparent",
        borderBottom: "1px solid rgba(0,77,20,0.2)",
        transition: "all 0.15s",
        fontSize: 13,
        alignItems: "center",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "rgba(0,255,65,0.05)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? "rgba(0,255,65,0.1)" : container.error ? "rgba(255,51,51,0.03)" : "transparent"; }}
    >
      <span style={{ color: statusColor, fontSize: 10 }}>{statusIcon}</span>
      <span style={{ color: "#00ff41", fontWeight: 600 }}>{container.name}</span>
      <span style={{ color: "#00aa30", fontSize: 11 }}>{container.image.length > 22 ? container.image.slice(0, 22) + "…" : container.image}</span>
      <span style={{ color: statusColor, fontSize: 11, textTransform: "uppercase" }}>{container.status}</span>
      <ProgressBar value={container.cpu} danger={container.cpu > 80} />
      <span style={{ color: container.mem > 75 ? "#ffaa00" : "#00cc38", fontSize: 12 }}>{container.memMb}MB</span>
      <span style={{ color: "#007a22", fontSize: 11 }}>{container.uptime}</span>
    </div>
  );
}

export default function DockerDashboard() {
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [activeTab, setActiveTab] = useState("STACKS");
  const [rightTab, setRightTab] = useState("INFO");
  const [shellOpen, setShellOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [bootDone, setBootDone] = useState(false);
  const [bootStage, setBootStage] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null);
  const [expandedStacks, setExpandedStacks] = useState(new Set(MOCK_STACKS.filter(s => s.status !== "stopped").map(s => s.name)));
  const [creating, setCreating] = useState(false);
  const [newStackName, setNewStackName] = useState("");
  const [newStackYaml, setNewStackYaml] = useState(`version: "3.8"

services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`);
  const [stackSearch, setStackSearch] = useState("");

  // Log filters
  const [logSearch, setLogSearch] = useState("");
  const [logLevels, setLogLevels] = useState({ INFO: true, WARN: true, ERR: true });

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const stages = [500, 800, 600, 700, 400];
    let current = 0;
    const advance = () => {
      if (current < stages.length) {
        setBootStage(current + 1);
        current++;
        setTimeout(advance, stages[current - 1]);
      } else {
        setBootDone(true);
      }
    };
    setTimeout(advance, 300);
  }, []);

  const runningCount = MOCK_CONTAINERS.filter(c => c.status === "running").length;
  const faultCount = MOCK_CONTAINERS.filter(c => c.status !== "running").length;
  const totalCpu = MOCK_CONTAINERS.reduce((a, c) => a + c.cpu, 0);
  const totalMem = MOCK_CONTAINERS.reduce((a, c) => a + c.memMb, 0);
  const stacksRunning = MOCK_STACKS.filter(s => s.status === "running").length;
  const stacksDegraded = MOCK_STACKS.filter(s => s.status === "partial").length;

  const filteredLogs = MOCK_LOGS.filter(log => {
    if (!logLevels[log.level]) return false;
    if (logSearch) {
      const s = logSearch.toLowerCase();
      return log.msg.toLowerCase().includes(s) || log.source.toLowerCase().includes(s);
    }
    return true;
  });

  const tabs = ["STACKS", "LOGS", "AI AGENT"];

  const toggleLevel = (level) => {
    setLogLevels(prev => ({ ...prev, [level]: !prev[level] }));
  };

  const toggleStack = (name) => {
    setExpandedStacks(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (!bootDone) {
    const bootLines = [
      "ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL",
      "DOCKER ENGINE v27.4.1 ... [OK]",
      "LOADING STACK MANIFESTS ... [OK]",
      "AI DIAGNOSTIC MODULE v0.3.1 ... [OK]",
      "ESTABLISHING SECURE CONNECTION ... [OK]",
    ];
    return (
      <div style={{
        background: "#0a0f0a",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet" />
        <style>{`@keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }`}</style>
        <CRTOverlay />
        <div style={{ color: "#00ff41", fontSize: 14, lineHeight: 2.2 }}>
          {bootLines.slice(0, bootStage).map((line, i) => (
            <div key={i} style={{ opacity: 0.9, textShadow: "0 0 8px rgba(0,255,65,0.5)" }}>{line}</div>
          ))}
          {bootStage <= bootLines.length && (
            <span style={{ animation: "blink 0.8s infinite" }}>█</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#0a0f0a",
      minHeight: "100vh",
      fontFamily: "'Share Tech Mono', monospace",
      color: "#00ff41",
      padding: 0,
      margin: 0,
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        * { scrollbar-width: thin; scrollbar-color: #00ff41 #0a0f0a; }
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: #0a0f0a; }
        *::-webkit-scrollbar-thumb { background: #00ff41; }
      `}</style>
      <CRTOverlay />

      {/* SHELL MODAL */}
      {shellOpen && selectedContainer && selectedContainer.status === "running" && (
        <ShellTerminal container={selectedContainer} onClose={() => setShellOpen(false)} />
      )}

      {/* CONFIRM MODAL */}
      {confirmAction && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 800,
          background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            border: `1px solid ${confirmAction.danger ? "#ff3333" : "#00ff41"}`,
            background: "#0a0f0a",
            padding: 24,
            minWidth: 360,
            boxShadow: `0 0 30px ${confirmAction.danger ? "rgba(255,51,51,0.2)" : "rgba(0,255,65,0.15)"}`,
          }}>
            <div style={{ fontSize: 13, color: confirmAction.danger ? "#ff3333" : "#ffaa00", marginBottom: 16, letterSpacing: 1 }}>
              ⚠ CONFIRM: {confirmAction.action}
            </div>
            <div style={{ fontSize: 12, color: "#00cc38", marginBottom: 8 }}>
              Container: <span style={{ color: "#00ff41" }}>{confirmAction.container}</span>
            </div>
            <div style={{ fontSize: 11, color: "#007a22", marginBottom: 20 }}>
              {confirmAction.danger
                ? "This action is destructive and cannot be undone."
                : "This will affect the running container."}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                onClick={() => { setConfirmAction(null); }}
                style={{
                  padding: "8px 20px",
                  border: `1px solid ${confirmAction.danger ? "#ff3333" : "#00ff41"}`,
                  color: confirmAction.danger ? "#ff3333" : "#00ff41",
                  cursor: "pointer",
                  fontSize: 12,
                  letterSpacing: 1,
                  background: confirmAction.danger ? "rgba(255,51,51,0.05)" : "rgba(0,255,65,0.05)",
                }}
              >
                [EXECUTE]
              </div>
              <div
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: "8px 20px",
                  border: "1px solid #007a22",
                  color: "#007a22",
                  cursor: "pointer",
                  fontSize: 12,
                  letterSpacing: 1,
                }}
              >
                [CANCEL]
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{
        borderBottom: "1px solid #00ff41",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(0,255,65,0.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <GlitchText style={{ fontSize: 20, fontWeight: 700, textShadow: "0 0 10px rgba(0,255,65,0.5)", letterSpacing: 2 }}>
            ⬡ DOCKYARD
          </GlitchText>
          <span style={{ color: "#007a22", fontSize: 11, marginTop: 2 }}>v0.1.0-alpha</span>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 12 }}>
          <span style={{ color: "#00aa30" }}>NODE: acer-veriton-x2690g</span>
          <span style={{ color: "#00aa30" }}>│</span>
          <span>
            <span style={{ color: runningCount > 0 ? "#00ff41" : "#ff3333" }}>● {runningCount} ONLINE</span>
            {faultCount > 0 && <span style={{ color: "#ff3333", marginLeft: 12, animation: "pulse 1.5s infinite" }}>✖ {faultCount} FAULT</span>}
            {stacksDegraded > 0 && <span style={{ color: "#ffaa00", marginLeft: 12 }}>⚠ {stacksDegraded} DEGRADED</span>}
          </span>
          <span style={{ color: "#00aa30" }}>│</span>
          <span style={{ color: "#00cc38" }}>{time.toLocaleTimeString("en-GB")}</span>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1,
        borderBottom: "1px solid #004d14",
        background: "#004d14",
      }}>
        {[
          { label: "STACKS", value: `${MOCK_STACKS.length}`, sub: `${stacksRunning} running${stacksDegraded > 0 ? ` • ${stacksDegraded} degraded` : ""}` },
          { label: "CPU LOAD", value: `${totalCpu.toFixed(1)}%`, sub: "12C / 20T" },
          { label: "MEMORY", value: `${totalMem}MB`, sub: "/ 32768MB" },
          { label: "CONTAINERS", value: `${MOCK_CONTAINERS.length}`, sub: `${runningCount} active • ${faultCount} fault` },
        ].map((stat, i) => (
          <div key={i} style={{ padding: "10px 20px", background: "#0a0f0a", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#007a22", letterSpacing: 2, marginBottom: 2 }}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: "#00aa30" }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #004d14",
        background: "rgba(0,255,65,0.02)",
      }}>
        {tabs.map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 24px",
              cursor: "pointer",
              fontSize: 12,
              letterSpacing: 1.5,
              color: activeTab === tab ? "#00ff41" : "#007a22",
              borderBottom: activeTab === tab ? "2px solid #00ff41" : "2px solid transparent",
              background: activeTab === tab ? "rgba(0,255,65,0.05)" : "transparent",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = "#00cc38"; }}
            onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = "#007a22"; }}
          >
            {tab === "AI AGENT" && faultCount > 0 && <span style={{ color: "#ffaa00", marginRight: 6 }}>⚠</span>}
            {tab}
          </div>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 16px",
        borderBottom: "1px solid #004d14",
        background: "rgba(0,255,65,0.015)",
      }}>
        {[
          { label: "+ COMPOSE", primary: true, action: () => { setCreating(true); setActiveTab("STACKS"); } },
          { label: "⟳ RESTART ALL", action: () => setConfirmAction({ action: "RESTART ALL STACKS", container: `${MOCK_STACKS.filter(s=>s.status!=="stopped").length} running stacks`, danger: false }) },
          { label: "↓ PULL IMAGES", action: () => setConfirmAction({ action: "PULL ALL IMAGES", container: "all stacks", danger: false }) },
          { label: "⌧ PRUNE", action: () => setConfirmAction({ action: "DOCKER SYSTEM PRUNE", container: "unused images, volumes, networks", danger: true }) },
        ].map((btn, i) => (
          <div key={i} onClick={btn.action} style={{
            padding: "5px 14px",
            border: `1px solid ${btn.primary ? "#00ff41" : btn.label.includes("PRUNE") ? "#ff333366" : "#004d14"}`,
            color: btn.primary ? "#00ff41" : btn.label.includes("PRUNE") ? "#ff6666" : "#00aa30",
            cursor: "pointer",
            fontSize: 11,
            letterSpacing: 0.5,
            fontWeight: btn.primary ? 700 : 400,
            background: btn.primary ? "rgba(0,255,65,0.05)" : "transparent",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = btn.label.includes("PRUNE") ? "rgba(255,51,51,0.08)" : "rgba(0,255,65,0.08)"; e.currentTarget.style.borderColor = btn.primary ? "#00ff41" : btn.label.includes("PRUNE") ? "#ff3333" : "#00ff41"; }}
            onMouseLeave={e => { e.currentTarget.style.background = btn.primary ? "rgba(0,255,65,0.05)" : "transparent"; e.currentTarget.style.borderColor = btn.primary ? "#00ff41" : btn.label.includes("PRUNE") ? "#ff333366" : "#004d14"; }}
          >{btn.label}</div>
        ))}

        {/* Stack search — right-aligned */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", border: "1px solid #004d14", padding: "3px 8px", background: "rgba(0,255,65,0.02)", minWidth: 180 }}>
          <span style={{ color: "#007a22", fontSize: 11, marginRight: 6 }}>⌕</span>
          <input
            value={stackSearch}
            onChange={e => setStackSearch(e.target.value)}
            placeholder="filter stacks..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#00ff41", fontFamily: "inherit", fontSize: 11, caretColor: "#00ff41" }}
            spellCheck={false}
          />
          {stackSearch && <span onClick={() => setStackSearch("")} style={{ color: "#007a22", cursor: "pointer", fontSize: 11 }}>✕</span>}
        </div>
      </div>

      {/* BODY */}
      <div style={{ display: "flex", height: "calc(100vh - 200px)" }}>

        {/* LEFT PANEL */}
        <div style={{ flex: 1, borderRight: "1px solid #004d14", display: "flex", flexDirection: "column" }}>

          {activeTab === "STACKS" && (
            <>
              {creating ? (
                /* ══════ COMPOSE EDITOR ══════ */
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Editor header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #004d14", background: "rgba(0,255,65,0.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "#00ff41", fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>+ NEW STACK</span>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #004d14", background: "rgba(0,255,65,0.02)" }}>
                        <span style={{ color: "#007a22", fontSize: 12, padding: "5px 8px", borderRight: "1px solid #004d14" }}>NAME:</span>
                        <input
                          value={newStackName}
                          onChange={e => setNewStackName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          placeholder="my-stack"
                          style={{ background: "transparent", border: "none", outline: "none", color: "#00ff41", fontFamily: "inherit", fontSize: 13, padding: "5px 10px", width: 200, caretColor: "#00ff41" }}
                          spellCheck={false}
                          autoFocus
                        />
                      </div>
                      {newStackName && <span style={{ color: "#007a22", fontSize: 10 }}>/opt/stacks/{newStackName}/compose.yaml</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div
                        onClick={() => {
                          if (newStackName) {
                            setCreating(false);
                            setNewStackName("");
                          }
                        }}
                        style={{
                          padding: "7px 20px",
                          border: `1px solid ${newStackName ? "#00ff41" : "#004d14"}`,
                          color: newStackName ? "#00ff41" : "#004d14",
                          cursor: newStackName ? "pointer" : "not-allowed",
                          fontSize: 12,
                          letterSpacing: 1,
                          fontWeight: 700,
                          background: newStackName ? "rgba(0,255,65,0.05)" : "transparent",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { if (newStackName) e.currentTarget.style.background = "rgba(0,255,65,0.15)"; }}
                        onMouseLeave={e => { if (newStackName) e.currentTarget.style.background = "rgba(0,255,65,0.05)"; }}
                      >▶ DEPLOY</div>
                      <div
                        onClick={() => { setCreating(false); setNewStackName(""); }}
                        style={{ padding: "7px 16px", border: "1px solid #007a22", color: "#007a22", cursor: "pointer", fontSize: 12, letterSpacing: 1, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff3333"; e.currentTarget.style.color = "#ff3333"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#007a22"; e.currentTarget.style.color = "#007a22"; }}
                      >CANCEL</div>
                    </div>
                  </div>

                  {/* Editor body — split: yaml left, preview right */}
                  <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                    {/* YAML Editor */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #004d14" }}>
                      <div style={{ padding: "6px 16px", fontSize: 10, color: "#007a22", letterSpacing: 1.5, borderBottom: "1px solid rgba(0,77,20,0.3)", background: "rgba(0,255,65,0.015)" }}>
                        compose.yaml
                      </div>
                      <div style={{ flex: 1, display: "flex", overflow: "auto" }}>
                        {/* Line numbers */}
                        <div style={{ padding: "10px 0", textAlign: "right", userSelect: "none", minWidth: 36, borderRight: "1px solid rgba(0,77,20,0.3)" }}>
                          {newStackYaml.split("\n").map((_, i) => (
                            <div key={i} style={{ color: "#004d14", fontSize: 12, lineHeight: "20px", paddingRight: 8 }}>{i + 1}</div>
                          ))}
                        </div>
                        <textarea
                          value={newStackYaml}
                          onChange={e => setNewStackYaml(e.target.value)}
                          style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#00ff41",
                            fontFamily: "inherit",
                            fontSize: 12,
                            lineHeight: "20px",
                            padding: "10px 12px",
                            resize: "none",
                            caretColor: "#00ff41",
                            tabSize: 2,
                          }}
                          spellCheck={false}
                          wrap="off"
                        />
                      </div>
                    </div>

                    {/* Preview panel */}
                    <div style={{ width: 280, overflow: "auto", padding: "12px 16px" }}>
                      <div style={{ fontSize: 10, color: "#007a22", letterSpacing: 1.5, marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid rgba(0,77,20,0.3)" }}>PREVIEW</div>
                      {(() => {
                        // Simple YAML parser — extract services
                        const lines = newStackYaml.split("\n");
                        const services = [];
                        let inServices = false;
                        let currentService = null;
                        let currentImage = "";
                        let currentPorts = [];

                        lines.forEach(line => {
                          const trimmed = line.trim();
                          if (trimmed === "services:") { inServices = true; return; }
                          if (inServices && /^  \S/.test(line) && line.trim().endsWith(":")) {
                            if (currentService) services.push({ name: currentService, image: currentImage, ports: currentPorts });
                            currentService = trimmed.replace(":", "");
                            currentImage = "";
                            currentPorts = [];
                          }
                          if (currentService && trimmed.startsWith("image:")) currentImage = trimmed.replace("image:", "").trim();
                          if (currentService && trimmed.startsWith("- \"") && trimmed.includes(":")) currentPorts.push(trimmed.replace(/^- "?|"?$/g, ""));
                        });
                        if (currentService) services.push({ name: currentService, image: currentImage, ports: currentPorts });

                        if (services.length === 0) return <div style={{ color: "#007a22", fontSize: 11 }}>Add services to compose.yaml to see preview</div>;

                        return (
                          <>
                            <div style={{ fontSize: 11, color: "#00aa30", marginBottom: 10 }}>{services.length} service{services.length !== 1 ? "s" : ""} detected</div>
                            {services.map((svc, i) => (
                              <div key={i} style={{ border: "1px solid #004d14", padding: "10px 12px", marginBottom: 8, background: "rgba(0,255,65,0.02)" }}>
                                <div style={{ color: "#00ff41", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>● {svc.name}</div>
                                {svc.image && <div style={{ fontSize: 10, color: "#007a22" }}>IMAGE: <span style={{ color: "#00aa30" }}>{svc.image}</span></div>}
                                {svc.ports.length > 0 && <div style={{ fontSize: 10, color: "#007a22", marginTop: 2 }}>PORTS: <span style={{ color: "#4488ff" }}>{svc.ports.join(", ")}</span></div>}
                              </div>
                            ))}
                          </>
                        );
                      })()}

                      {/* Templates */}
                      <div style={{ fontSize: 10, color: "#007a22", letterSpacing: 1.5, marginTop: 20, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(0,77,20,0.3)" }}>TEMPLATES</div>
                      {[
                        { name: "Nginx + SSL", desc: "Reverse proxy with Let's Encrypt", yaml: `version: "3.8"\n\nservices:\n  nginx:\n    image: nginx:alpine\n    ports:\n      - "80:80"\n      - "443:443"\n    volumes:\n      - ./conf:/etc/nginx/conf.d\n      - certs:/etc/letsencrypt\n    restart: unless-stopped\n\nvolumes:\n  certs:` },
                        { name: "Postgres + Redis", desc: "Database stack", yaml: `version: "3.8"\n\nservices:\n  postgres:\n    image: postgres:16\n    ports:\n      - "5432:5432"\n    environment:\n      POSTGRES_DB: app\n      POSTGRES_USER: admin\n      POSTGRES_PASSWORD: changeme\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    restart: unless-stopped\n\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "6379:6379"\n    restart: unless-stopped\n\nvolumes:\n  pgdata:` },
                        { name: "Node.js App", desc: "Node with hot reload", yaml: `version: "3.8"\n\nservices:\n  app:\n    image: node:20-slim\n    ports:\n      - "3000:3000"\n    volumes:\n      - ./src:/app/src\n    working_dir: /app\n    command: npm run dev\n    restart: unless-stopped` },
                      ].map((tpl, i) => (
                        <div key={i}
                          onClick={() => { setNewStackYaml(tpl.yaml); if (!newStackName) setNewStackName(tpl.name.toLowerCase().replace(/[^a-z0-9]/g, "-")); }}
                          style={{ padding: "8px 10px", border: "1px solid #004d14", marginBottom: 4, cursor: "pointer", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#00ff41"; e.currentTarget.style.background = "rgba(0,255,65,0.05)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "#004d14"; e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ color: "#00ff41", fontSize: 11, fontWeight: 600 }}>{tpl.name}</div>
                          <div style={{ color: "#007a22", fontSize: 9 }}>{tpl.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
              /* ══════ STACK LIST ══════ */
              <div style={{ flex: 1, overflow: "auto" }}>
                {MOCK_STACKS.filter(s => !stackSearch || s.name.toLowerCase().includes(stackSearch.toLowerCase()) || s.containers.some(c => c.name.toLowerCase().includes(stackSearch.toLowerCase()))).map((stack, si) => {
                  const expanded = expandedStacks.has(stack.name);
                  const running = stack.containers.filter(c => c.status === "running").length;
                  const total = stack.containers.length;
                  const sCpu = stack.containers.reduce((a, c) => a + c.cpu, 0);
                  const sMem = stack.containers.reduce((a, c) => a + c.memMb, 0);
                  const statusColor = stack.status === "running" ? "#00ff41" : stack.status === "partial" ? "#ffaa00" : "#555";
                  const statusIcon = stack.status === "running" ? "●" : stack.status === "partial" ? "⚠" : "○";

                  return (
                    <div key={stack.name} style={{ animation: `fadeIn 0.3s ease ${si * 0.04}s both` }}>
                      {/* Stack header */}
                      <div
                        onClick={() => toggleStack(stack.name)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "20px 1fr 140px 80px 140px 100px 70px",
                          gap: 8,
                          padding: "7px 12px",
                          cursor: "pointer",
                          background: stack.status === "partial" ? "rgba(255,170,0,0.04)" : "rgba(0,255,65,0.03)",
                          borderBottom: "1px solid #004d14",
                          alignItems: "center",
                          fontSize: 13,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,65,0.06)"}
                        onMouseLeave={e => e.currentTarget.style.background = stack.status === "partial" ? "rgba(255,170,0,0.04)" : "rgba(0,255,65,0.03)"}
                      >
                        <span style={{ color: "#007a22", fontSize: 10, display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                        <span style={{ color: statusColor, fontWeight: 700 }}>
                          {statusIcon} {stack.name}
                          <span style={{ color: "#007a22", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>{running}/{total}</span>
                        </span>
                        <span style={{ color: "#007a22", fontSize: 11 }}>{stack.path}</span>
                        <span style={{ color: statusColor, fontSize: 11, textTransform: "uppercase" }}>{stack.status === "partial" ? "DEGRADED" : stack.status}</span>
                        <span></span>
                        <span></span>
                        <span style={{ color: "#007a22", fontSize: 11 }}></span>
                      </div>

                      {/* Container rows */}
                      {expanded && (
                        <>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "20px 1fr 140px 80px 140px 100px 70px",
                            gap: 8,
                            padding: "4px 12px 4px 32px",
                            fontSize: 9,
                            color: "#004d14",
                            letterSpacing: 1.5,
                            borderBottom: "1px solid rgba(0,77,20,0.3)",
                            background: "rgba(0,255,65,0.015)",
                          }}>
                            <span></span><span>CONTAINER</span><span>IMAGE</span><span>STATE</span><span>CPU</span><span>MEMORY</span><span>UPTIME</span>
                          </div>
                          {stack.containers.map((c, i) => (
                            <div key={c.id} style={{ animation: `fadeIn 0.15s ease ${i * 0.03}s both` }}>
                              <ContainerRow
                                container={c}
                                selected={selectedContainer?.id === c.id}
                                onClick={() => { setSelectedContainer(c); setRightTab("INFO"); }}
                                indent
                              />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </>
          )}

          {activeTab === "LOGS" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Log Filter Bar */}
              <div style={{
                padding: "8px 12px",
                borderBottom: "1px solid #004d14",
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}>
                <span style={{ fontSize: 10, color: "#007a22", letterSpacing: 1.5, marginRight: 4 }}>FILTER:</span>

                {/* Search Input */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #004d14",
                  padding: "4px 8px",
                  flex: 1,
                  maxWidth: 350,
                  background: "rgba(0,255,65,0.02)",
                }}>
                  <span style={{ color: "#007a22", fontSize: 12, marginRight: 6 }}>{">"}</span>
                  <input
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    placeholder="search logs..."
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "#00ff41",
                      fontFamily: "inherit",
                      fontSize: 12,
                      caretColor: "#00ff41",
                    }}
                    spellCheck={false}
                  />
                  {logSearch && (
                    <span
                      onClick={() => setLogSearch("")}
                      style={{ color: "#007a22", cursor: "pointer", fontSize: 12, marginLeft: 4 }}
                    >✕</span>
                  )}
                </div>

                {/* Level Toggles */}
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { level: "INFO", color: "#00ff41", activeColor: "#00ff41" },
                    { level: "WARN", color: "#ffaa00", activeColor: "#ffaa00" },
                    { level: "ERR", color: "#ff3333", activeColor: "#ff3333" },
                  ].map(({ level, color, activeColor }) => (
                    <div
                      key={level}
                      onClick={() => toggleLevel(level)}
                      style={{
                        padding: "4px 12px",
                        fontSize: 11,
                        letterSpacing: 1,
                        cursor: "pointer",
                        border: `1px solid ${logLevels[level] ? activeColor : "#004d14"}`,
                        color: logLevels[level] ? activeColor : "#004d14",
                        background: logLevels[level] ? `${activeColor}11` : "transparent",
                        transition: "all 0.15s",
                        userSelect: "none",
                      }}
                    >
                      {level}
                    </div>
                  ))}
                </div>

                <span style={{ fontSize: 10, color: "#007a22", marginLeft: "auto" }}>
                  {filteredLogs.length}/{MOCK_LOGS.length} entries
                </span>
              </div>

              {/* Log Entries */}
              <div style={{ flex: 1, overflow: "auto", padding: "4px 12px" }}>
                {filteredLogs.length === 0 ? (
                  <div style={{ color: "#007a22", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                    No logs match current filters
                  </div>
                ) : (
                  filteredLogs.map((log, i) => (
                    <div key={i} style={{
                      fontSize: 12,
                      padding: "3px 0",
                      display: "flex",
                      gap: 8,
                      animation: `fadeIn 0.3s ease ${i * 0.03}s both`,
                    }}>
                      <span style={{ color: "#007a22", minWidth: 65 }}>{log.time}</span>
                      <span style={{
                        color: log.level === "ERR" ? "#ff3333" : log.level === "WARN" ? "#ffaa00" : "#00aa30",
                        minWidth: 40,
                        fontWeight: log.level === "ERR" ? 700 : 400,
                      }}>{log.level}</span>
                      <span style={{ color: "#00cc38", minWidth: 130 }}>[{log.source}]</span>
                      <span style={{
                        color: log.level === "ERR" ? "#ff6666" : log.level === "WARN" ? "#ffcc44" : "#00ff41",
                      }}>
                        {logSearch ? (
                          (() => {
                            const idx = log.msg.toLowerCase().indexOf(logSearch.toLowerCase());
                            if (idx === -1) return log.msg;
                            return (
                              <>
                                {log.msg.slice(0, idx)}
                                <span style={{ background: "rgba(0,255,65,0.25)", padding: "0 1px" }}>
                                  {log.msg.slice(idx, idx + logSearch.length)}
                                </span>
                                {log.msg.slice(idx + logSearch.length)}
                              </>
                            );
                          })()
                        ) : log.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "AI AGENT" && (
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div style={{
                border: "1px solid #ffaa00",
                padding: 16,
                marginBottom: 16,
                background: "rgba(255,170,0,0.03)",
              }}>
                <div style={{ color: "#ffaa00", fontSize: 13, fontWeight: 700, marginBottom: 12, letterSpacing: 1.5 }}>
                  ⚠ {AI_ANALYSIS.title}
                </div>
                <div style={{ fontSize: 12, marginBottom: 8, color: "#00aa30" }}>
                  Container: <span style={{ color: "#ff6666" }}>{AI_ANALYSIS.container}</span> — {AI_ANALYSIS.timestamp}
                </div>
                <div style={{ fontSize: 11, color: "#007a22", letterSpacing: 1, marginBottom: 6, marginTop: 16 }}>DIAGNOSIS:</div>
                {AI_ANALYSIS.diagnosis.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#00ff41", padding: "3px 0 3px 16px" }}>{">"} {d}</div>
                ))}
                <div style={{ fontSize: 11, color: "#007a22", letterSpacing: 1, marginBottom: 6, marginTop: 16 }}>RECOMMENDED FIX:</div>
                <div style={{ fontSize: 12, color: "#ffcc44", padding: "3px 0 3px 16px" }}>{">"} {AI_ANALYSIS.suggestion}</div>
                <div style={{ fontSize: 11, color: "#007a22", letterSpacing: 1, marginBottom: 6, marginTop: 16 }}>AUTOFIX COMMAND:</div>
                <div style={{
                  fontSize: 11, color: "#00ff41", background: "rgba(0,255,65,0.05)",
                  padding: "8px 12px", border: "1px solid #004d14", marginTop: 4,
                }}>$ {AI_ANALYSIS.autofix}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <div style={{
                    padding: "8px 20px", border: "1px solid #00ff41", color: "#00ff41",
                    cursor: "pointer", fontSize: 12, letterSpacing: 1, background: "rgba(0,255,65,0.05)",
                  }}
                    onClick={() => setConfirmAction({ action: "EXECUTE AUTOFIX", container: AI_ANALYSIS.container, danger: false })}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,65,0.15)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(0,255,65,0.05)"}
                  >[EXECUTE FIX]</div>
                  <div style={{
                    padding: "8px 20px", border: "1px solid #007a22", color: "#007a22",
                    cursor: "pointer", fontSize: 12, letterSpacing: 1,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#00aa30"; e.currentTarget.style.color = "#00aa30"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#007a22"; e.currentTarget.style.color = "#007a22"; }}
                  >[DISMISS]</div>
                </div>
                <div style={{ fontSize: 10, color: "#007a22", marginTop: 12 }}>
                  CONFIDENCE: {AI_ANALYSIS.confidence}% — MODEL: claude-sonnet-4-20250514 — TOKENS: 847
                </div>
              </div>
              <div style={{ border: "1px solid #004d14", padding: 16 }}>
                <div style={{ fontSize: 11, color: "#007a22", letterSpacing: 1.5, marginBottom: 12 }}>AI AGENT STATUS</div>
                <div style={{ fontSize: 12, color: "#00ff41", lineHeight: 2 }}>
                  <div>Mode: <span style={{ color: "#00cc38" }}>MONITOR + ANALYZE</span></div>
                  <div>Auto-fix: <span style={{ color: "#ffaa00" }}>REQUIRES APPROVAL</span></div>
                  <div>Backend: <span style={{ color: "#00cc38" }}>Ollama (llama3.1:8b-q5) / Claude API fallback</span></div>
                  <div>Last scan: <span style={{ color: "#00cc38" }}>14 seconds ago</span></div>
                  <div>Alerts today: <span style={{ color: "#ffaa00" }}>3 warnings, 1 critical</span></div>
                  <div>Integrations: <span style={{ color: "#00cc38" }}>Telegram ● Uptime Kuma ● Grafana</span></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: 320, overflow: "auto", background: "rgba(0,255,65,0.01)" }}>
          {selectedContainer ? (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              {/* Right Panel Tabs */}
              <div style={{
                display: "flex",
                borderBottom: "1px solid #004d14",
              }}>
                {["INFO", "ENV", "VOLUMES"].map(tab => (
                  <div
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      textAlign: "center",
                      fontSize: 10,
                      letterSpacing: 1.5,
                      cursor: "pointer",
                      color: rightTab === tab ? "#00ff41" : "#007a22",
                      borderBottom: rightTab === tab ? "1px solid #00ff41" : "1px solid transparent",
                      background: rightTab === tab ? "rgba(0,255,65,0.03)" : "transparent",
                    }}
                  >
                    {tab}
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>
                  {selectedContainer.name}
                </div>

                {rightTab === "INFO" && (
                  <>
                    {[
                      ["ID", selectedContainer.id],
                      ["IMAGE", selectedContainer.image],
                      ["STATUS", selectedContainer.status.toUpperCase()],
                      ["HEALTH", selectedContainer.health],
                      ["CPU", `${selectedContainer.cpu}%`],
                      ["MEMORY", `${selectedContainer.memMb}MB (${selectedContainer.mem}%)`],
                      ["PORTS", selectedContainer.ports],
                      ["UPTIME", selectedContainer.uptime],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid rgba(0,77,20,0.3)" }}>
                        <span style={{ color: "#007a22" }}>{k}</span>
                        <span style={{
                          color: (k === "STATUS" && v === "EXITED") || (k === "HEALTH" && v === "FAULT") ? "#ff3333" : "#00ff41",
                          fontWeight: k === "STATUS" || k === "HEALTH" ? 700 : 400,
                        }}>{v}</span>
                      </div>
                    ))}

                    {selectedContainer.error && (
                      <div style={{ marginTop: 16, border: "1px solid #ff3333", padding: 12, background: "rgba(255,51,51,0.05)" }}>
                        <div style={{ fontSize: 10, color: "#ff3333", letterSpacing: 1.5, marginBottom: 8 }}>⚠ AI DIAGNOSIS</div>
                        <div style={{ fontSize: 11, color: "#ff9999", lineHeight: 1.6 }}>{selectedContainer.error}</div>
                      </div>
                    )}
                  </>
                )}

                {rightTab === "ENV" && (
                  <div style={{ fontSize: 11 }}>
                    {[
                      ["NODE_ENV", "production"],
                      ["DB_HOST", "postgres-main"],
                      ["DB_PORT", "5432"],
                      ["REDIS_URL", "redis://redis-cache:6379"],
                      ["BATCH_CONCURRENCY", "4"],
                      ["MAX_MEMORY", "1024"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: "4px 0", borderBottom: "1px solid rgba(0,77,20,0.3)", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#007a22" }}>{k}</span>
                        <span style={{ color: "#00cc38" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {rightTab === "VOLUMES" && (
                  <div style={{ fontSize: 11 }}>
                    {[
                      ["/app/data", "/opt/stacks/scraper/data"],
                      ["/app/logs", "/opt/stacks/scraper/logs"],
                      ["/app/.env", "/opt/stacks/scraper/.env"],
                    ].map(([container, host]) => (
                      <div key={container} style={{ padding: "6px 0", borderBottom: "1px solid rgba(0,77,20,0.3)" }}>
                        <div style={{ color: "#00ff41" }}>{container}</div>
                        <div style={{ color: "#007a22", fontSize: 10 }}>→ {host}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20 }}>
                  {/* Shell button - prominent */}
                  <div
                    onClick={() => {
                      if (selectedContainer.status === "running") setShellOpen(true);
                    }}
                    style={{
                      padding: "10px 12px",
                      border: selectedContainer.status === "running" ? "1px solid #00ff41" : "1px solid #004d14",
                      color: selectedContainer.status === "running" ? "#00ff41" : "#004d14",
                      cursor: selectedContainer.status === "running" ? "pointer" : "not-allowed",
                      fontSize: 12,
                      letterSpacing: 1.5,
                      textAlign: "center",
                      background: "rgba(0,255,65,0.05)",
                      transition: "all 0.2s",
                      fontWeight: 700,
                    }}
                    onMouseEnter={e => { if (selectedContainer.status === "running") e.currentTarget.style.background = "rgba(0,255,65,0.15)"; }}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(0,255,65,0.05)"}
                  >
                    {">"} OPEN SHELL
                  </div>

                  {/* Other actions */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {["RESTART", "STOP", "LOGS", "REMOVE"].map(action => (
                      <div
                        key={action}
                        onClick={() => {
                          if (action === "REMOVE" || action === "STOP" || action === "RESTART") {
                            setConfirmAction({
                              action,
                              container: selectedContainer.name,
                              danger: action === "REMOVE",
                            });
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          border: `1px solid ${action === "REMOVE" ? "#ff3333" : "#004d14"}`,
                          color: action === "REMOVE" ? "#ff3333" : "#00aa30",
                          cursor: "pointer",
                          fontSize: 11,
                          letterSpacing: 1,
                          textAlign: "center",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = action === "REMOVE" ? "rgba(255,51,51,0.1)" : "rgba(0,255,65,0.05)";
                          e.currentTarget.style.borderColor = action === "REMOVE" ? "#ff3333" : "#00ff41";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.borderColor = action === "REMOVE" ? "#ff3333" : "#004d14";
                        }}
                      >
                        [{action}]
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
              <div style={{ color: "#004d14", fontSize: 32 }}>⬡</div>
              <div style={{ color: "#007a22", fontSize: 12 }}>SELECT CONTAINER</div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        borderTop: "1px solid #004d14",
        padding: "4px 24px",
        fontSize: 10,
        color: "#007a22",
        background: "#0a0f0a",
        display: "flex",
        justifyContent: "space-between",
        zIndex: 999,
      }}>
        <span>DOCKYARD TERMINAL v0.1.0-alpha — ROBCO INDUSTRIES (TM)</span>
        <span>HOST: Ubuntu 24.04 LTS — DOCKER: 27.4.1 — COMPOSE: 2.32.1</span>
        <span>NET: ▲ 2.4 MB/s ▼ 847 KB/s — LOAD: 1.23 1.45 1.12</span>
      </div>
    </div>
  );
}
