import styles from './LogsPanel.module.css';

const LEVEL_COLORS = {
  INFO: { color: "#00ff41", activeColor: "#00ff41" },
  WARN: { color: "#ffaa00", activeColor: "#ffaa00" },
  ERR: { color: "#ff3333", activeColor: "#ff3333" },
};

export default function LogsPanel({ logs, totalCount, logSearch, onSearchChange, logLevels, onToggleLevel }) {
  return (
    <div className={styles.container}>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>FILTER:</span>

        <div className={styles.searchBox}>
          <span className={styles.searchPrompt}>{">"}</span>
          <input
            value={logSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="search logs..."
            className={styles.searchInput}
            spellCheck={false}
          />
          {logSearch && (
            <span onClick={() => onSearchChange("")} className={styles.clearBtn}>✕</span>
          )}
        </div>

        <div className={styles.levelToggles}>
          {Object.entries(LEVEL_COLORS).map(([level, { activeColor }]) => (
            <div
              key={level}
              onClick={() => onToggleLevel(level)}
              className={styles.levelToggle}
              style={{
                border: `1px solid ${logLevels[level] ? activeColor : "#004d14"}`,
                color: logLevels[level] ? activeColor : "#004d14",
                background: logLevels[level] ? `${activeColor}11` : "transparent",
              }}
            >
              {level}
            </div>
          ))}
        </div>

        <span className={styles.counter}>
          {logs.length}/{totalCount} entries
        </span>
      </div>

      {/* Log Entries */}
      <div className={styles.entries}>
        {logs.length === 0 ? (
          <div className={styles.empty}>No logs match current filters</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={styles.logLine} style={{ animation: `fadeIn 0.3s ease ${i * 0.03}s both` }}>
              <span className={styles.logTime}>{log.time}</span>
              <span style={{
                color: log.level === "ERR" ? "#ff3333" : log.level === "WARN" ? "#ffaa00" : "#00aa30",
                minWidth: 40,
                fontWeight: log.level === "ERR" ? 700 : 400,
              }}>{log.level}</span>
              <span className={styles.logSource}>[{log.source}]</span>
              <span style={{
                color: log.level === "ERR" ? "#ff6666" : log.level === "WARN" ? "#ffcc44" : "#00ff41",
              }}>
                {logSearch ? highlightSearch(log.msg, logSearch) : log.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function highlightSearch(msg, search) {
  const idx = msg.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return msg;
  return (
    <>
      {msg.slice(0, idx)}
      <span style={{ background: "rgba(0,255,65,0.25)", padding: "0 1px" }}>
        {msg.slice(idx, idx + search.length)}
      </span>
      {msg.slice(idx + search.length)}
    </>
  );
}
