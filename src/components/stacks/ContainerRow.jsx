import ProgressBar from '../ui/ProgressBar';
import styles from './ContainerRow.module.css';

export default function ContainerRow({ container, selected, onClick, indent }) {
  const stopped = container.status !== "running";
  const statusColor = stopped ? "#ff3333" : "#00ff41";
  const statusIcon = stopped ? "○" : "●";
  const dim = stopped && !selected;

  const className = selected
    ? styles.rowSelected
    : container.error
      ? styles.rowError
      : stopped
        ? styles.rowStopped
        : styles.row;

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        padding: indent ? "5px 12px 5px 32px" : "6px 12px",
        borderLeft: selected ? undefined : "2px solid transparent",
      }}
    >
      <span style={{ color: dim ? "#553333" : statusColor, fontSize: 10 }}>{statusIcon}</span>
      <span style={{ color: dim ? "#005522" : container.managed === false ? "#005522" : "#00ff41", fontWeight: 600 }}>{container.name}</span>
      <span style={{ color: dim ? "#004d14" : "#00aa30", fontSize: 11 }}>{container.image.length > 22 ? container.image.slice(0, 22) + "\u2026" : container.image}</span>
      <span style={{ color: dim ? "#553333" : statusColor, fontSize: 11, textTransform: "uppercase" }}>{container.status}</span>
      <ProgressBar value={container.cpu} danger={container.cpu > 80} />
      <span style={{ color: dim ? "#004d14" : container.mem > 75 ? "#ffaa00" : "#00cc38", fontSize: 12 }}>{container.memMb}MB</span>
      <span style={{ color: dim ? "#003310" : "#007a22", fontSize: 11 }}>{container.uptime}</span>
    </div>
  );
}
