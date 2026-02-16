import CRTOverlay from '../ui/CRTOverlay';
import styles from './BootScreen.module.css';

function getBootLines(systemInfo, stackCount) {
  const { dockerVersion, hostname, hostOs } = systemInfo;
  const hasVersion = dockerVersion && dockerVersion !== 'N/A';
  const hasHost = hostname && hostname !== 'unknown';

  return [
    "DOCKTERMINAL (TM) TERMLINK PROTOCOL",
    hasVersion
      ? `DOCKER ENGINE v${dockerVersion} ... [OK]`
      : "DOCKER ENGINE ... [DETECTING]",
    stackCount > 0
      ? `LOADING ${stackCount} STACK MANIFESTS ... [OK]`
      : "LOADING STACK MANIFESTS ... [OK]",
    "AI DIAGNOSTIC MODULE v0.3.1 ... [OK]",
    hasHost
      ? `UPLINK TO ${hostname.toUpperCase()} (${hostOs}) ... [OK]`
      : "ESTABLISHING SECURE CONNECTION ... [DETECTING]",
  ];
}

export default function BootScreen({ bootStage, systemInfo, stackCount }) {
  const lines = getBootLines(systemInfo, stackCount);

  return (
    <div className={styles.container}>
      <CRTOverlay />
      <div className={styles.content}>
        {lines.slice(0, bootStage).map((line, i) => (
          <div key={i} className={styles.line}>{line}</div>
        ))}
        {bootStage <= lines.length && (
          <span className={styles.cursor}>█</span>
        )}
      </div>
    </div>
  );
}
