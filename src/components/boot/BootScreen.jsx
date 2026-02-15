import CRTOverlay from '../ui/CRTOverlay';
import styles from './BootScreen.module.css';

const BOOT_LINES = [
  "DOCKTERMINAL (TM) TERMLINK PROTOCOL",
  "DOCKER ENGINE v27.4.1 ... [OK]",
  "LOADING STACK MANIFESTS ... [OK]",
  "AI DIAGNOSTIC MODULE v0.3.1 ... [OK]",
  "ESTABLISHING SECURE CONNECTION ... [OK]",
];

export default function BootScreen({ bootStage }) {
  return (
    <div className={styles.container}>
      <CRTOverlay />
      <div className={styles.content}>
        {BOOT_LINES.slice(0, bootStage).map((line, i) => (
          <div key={i} className={styles.line}>{line}</div>
        ))}
        {bootStage <= BOOT_LINES.length && (
          <span className={styles.cursor}>█</span>
        )}
      </div>
    </div>
  );
}
