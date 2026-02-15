import { useState, useEffect, useRef } from 'react';
import styles from './ShellTerminal.module.css';

export default function ShellTerminal({ container, onClose }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    if (e.key !== "Enter" || !input.trim() || running) return;
    const cmd = input.trim();
    setInput("");

    if (cmd === "exit") {
      onClose();
      return;
    }

    setHistory(prev => [...prev, { type: "input", text: cmd }]);
    setRunning(true);

    try {
      const res = await fetch(`/api/container/${container.id}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      const output = (data.stdout || '') + (data.stderr ? (data.stdout ? '\n' : '') + data.stderr : '');
      if (output.trim()) {
        setHistory(prev => [...prev, { type: "output", text: output.trimEnd() }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { type: "output", text: `Error: ${err.message}` }]);
    }

    setRunning(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.terminal}>
        {/* Shell Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            SHELL — {container.name} ({container.id.slice(0, 12)}) — /bin/sh
          </div>
          <div className={styles.headerRight}>
            <span className={styles.hint}>type 'exit' or press ESC to close</span>
            <div
              onClick={onClose}
              className={styles.closeBtn}
              onMouseEnter={e => e.currentTarget.style.textShadow = "0 0 8px rgba(255,51,51,0.8)"}
              onMouseLeave={e => e.currentTarget.style.textShadow = "none"}
            >
              ✕
            </div>
          </div>
        </div>

        {/* Shell Output */}
        <div ref={scrollRef} className={styles.output} onClick={() => inputRef.current?.focus()}>
          <div className={styles.welcome}>
            Connected to {container.name} ({container.image}){"\n"}
            ─────────────────────────────────────────
          </div>
          {history.map((entry, i) => (
            <div key={i} style={{ marginBottom: entry.type === "output" ? 8 : 0 }}>
              {entry.type === "input" ? (
                <div>
                  <span style={{ color: "#00aa30" }}>root@{container.id.slice(0, 8)}</span>
                  <span style={{ color: "#007a22" }}>:</span>
                  <span style={{ color: "#4488ff" }}>~</span>
                  <span style={{ color: "#007a22" }}>$ </span>
                  <span style={{ color: "#00ff41" }}>{entry.text}</span>
                </div>
              ) : (
                <pre className={styles.outputText}>{entry.text}</pre>
              )}
            </div>
          ))}

          {running && (
            <div style={{ color: '#007a22', fontSize: 11 }}>executing...</div>
          )}

          {/* Input Line */}
          <div className={styles.inputLine}>
            <span style={{ color: "#00aa30" }}>root@{container.id.slice(0, 8)}</span>
            <span style={{ color: "#007a22" }}>:</span>
            <span style={{ color: "#4488ff" }}>~</span>
            <span style={{ color: "#007a22" }}>$ </span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                handleSubmit(e);
                if (e.key === "Escape") onClose();
              }}
              className={styles.shellInput}
              spellCheck={false}
              autoComplete="off"
              disabled={running}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
