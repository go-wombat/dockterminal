import styles from './CRTOverlay.module.css';

export default function CRTOverlay() {
  return (
    <div className={styles.overlay}>
      <div className={styles.scanlines} />
      <div className={styles.vignette} />
    </div>
  );
}
