import styles from './ProgressBar.module.css';

export default function ProgressBar({ value, max = 100, danger = false }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = danger ? 'var(--color-danger)' : pct > 75 ? 'var(--color-warning)' : 'var(--color-primary)';
  const blocks = Math.floor(pct / 5);
  const bar = '\u2588'.repeat(blocks) + '\u2591'.repeat(20 - blocks);

  return (
    <span className={styles.bar} style={{ color }}>
      [{bar}] {value.toFixed(1)}%
    </span>
  );
}
