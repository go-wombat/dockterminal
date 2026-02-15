import { useSystemInfo } from '../../hooks/useSystemInfo';
import styles from './StatusBar.module.css';

export default function StatusBar({
  version = 'v0.1.0-alpha',
  netUp = '2.4 MB/s',
  netDown = '847 KB/s',
  load = '1.23 1.45 1.12',
}) {
  const { hostOs, dockerVersion, composeVersion } = useSystemInfo();

  return (
    <div className={styles.statusBar}>
      <span>DOCKYARD TERMINAL {version} — ROBCO INDUSTRIES (TM)</span>
      <span>HOST: {hostOs} — DOCKER: {dockerVersion} — COMPOSE: {composeVersion}</span>
      <span>NET: ▲ {netUp} ▼ {netDown} — LOAD: {load}</span>
    </div>
  );
}
