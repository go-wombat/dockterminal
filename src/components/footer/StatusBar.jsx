import { useSystemInfo } from '../../hooks/useSystemInfo';
import styles from './StatusBar.module.css';

export default function StatusBar({
  version = 'v0.1.0-alpha',
  netUp = '\u2014',
  netDown = '\u2014',
  load = '\u2014 \u2014 \u2014',
}) {
  const { hostOs, dockerVersion, composeVersion } = useSystemInfo();

  return (
    <div className={styles.statusBar}>
      <span>DOCKTERMINAL {version} — ROBCO INDUSTRIES (TM)</span>
      <span>HOST: {hostOs} — DOCKER: {dockerVersion} — COMPOSE: {composeVersion}</span>
      <span>NET: ▲ {netUp} ▼ {netDown} — LOAD: {load}</span>
    </div>
  );
}
