import GlitchText from '../ui/GlitchText';
import styles from './Header.module.css';

export default function Header({ runningCount = 0, faultCount = 0, stacksDegraded = 0, time, nodeName = 'acer-veriton-x2690g', nodeIp = '192.168.1.50' }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <GlitchText style={{ fontSize: 20, fontWeight: 700, textShadow: '0 0 10px rgba(0,255,65,0.5)', letterSpacing: 2 }}>
          ⬡ DOCKTERMINAL
        </GlitchText>
        <span className={styles.version}>v0.1.0-alpha</span>
      </div>

      <div className={styles.right}>
        <span className={styles.nodeName}>NODE: {nodeName} ({nodeIp})</span>
        <span className={styles.separator}>│</span>
        <span>
          <span style={{ color: runningCount > 0 ? '#00ff41' : '#ff3333' }}>● {runningCount} ONLINE</span>
          {faultCount > 0 && (
            <span className={styles.fault}>✖ {faultCount} FAULT</span>
          )}
          {stacksDegraded > 0 && (
            <span className={styles.degraded}>⚠ {stacksDegraded} DEGRADED</span>
          )}
        </span>
        <span className={styles.separator}>│</span>
        <span className={styles.clock}>
          {time ? time.toLocaleTimeString('en-GB') : '--:--:--'}
        </span>
      </div>
    </header>
  );
}
