import styles from './AIAgentPanel.module.css';

export default function AIAgentPanel({ analysis, onExecuteFix }) {
  return (
    <div className={styles.container}>
      {analysis ? (
        /* Analysis Card */
        <div className={styles.analysisCard}>
          <div className={styles.title}>⚠ {analysis.title}</div>
          <div className={styles.meta}>
            Container: <span style={{ color: "#ff6666" }}>{analysis.container}</span> — {analysis.timestamp}
          </div>

          <div className={styles.sectionLabel}>DIAGNOSIS:</div>
          {analysis.diagnosis.map((d, i) => (
            <div key={i} className={styles.diagnosisItem}>{">"} {d}</div>
          ))}

          <div className={styles.sectionLabel}>RECOMMENDED FIX:</div>
          <div className={styles.suggestion}>{">"} {analysis.suggestion}</div>

          <div className={styles.sectionLabel}>AUTOFIX COMMAND:</div>
          <div className={styles.autofixCmd}>$ {analysis.autofix}</div>

          <div className={styles.actions}>
            <div
              className={styles.executeBtn}
              onClick={() => onExecuteFix(analysis)}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,65,0.15)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(0,255,65,0.05)"}
            >[EXECUTE FIX]</div>
            <div
              className={styles.dismissBtn}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#00aa30"; e.currentTarget.style.color = "#00aa30"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#007a22"; e.currentTarget.style.color = "#007a22"; }}
            >[DISMISS]</div>
          </div>

          <div className={styles.confidence}>
            CONFIDENCE: {analysis.confidence}% — AUTO-DIAGNOSIS
          </div>
        </div>
      ) : (
        /* All clear */
        <div className={styles.analysisCard}>
          <div className={styles.title} style={{ color: '#00ff41' }}>ALL SYSTEMS OPERATIONAL</div>
          <div className={styles.meta}>
            All containers are running. No issues detected.
          </div>
          <div className={styles.diagnosisItem} style={{ marginTop: 12 }}>
            {">"} Continuous monitoring active
          </div>
          <div className={styles.diagnosisItem}>
            {">"} Next scan in ~3 seconds
          </div>
        </div>
      )}

      {/* AI Agent Status Card */}
      <div className={styles.statusCard}>
        <div className={styles.statusTitle}>AI AGENT STATUS</div>
        <div className={styles.statusBody}>
          <div>Mode: <span style={{ color: "#00cc38" }}>MONITOR + ANALYZE</span></div>
          <div>Auto-fix: <span style={{ color: "#ffaa00" }}>REQUIRES APPROVAL</span></div>
          <div>Source: <span style={{ color: "#00cc38" }}>Docker Engine API (live)</span></div>
          <div>Scan interval: <span style={{ color: "#00cc38" }}>3s (polling)</span></div>
        </div>
      </div>
    </div>
  );
}
