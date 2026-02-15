import ProgressBar from '../ui/ProgressBar';
import styles from './ContainerRow.module.css';

export default function ContainerRow({ container, selected, onClick, indent }) {
  const statusColor = container.status === "running" ? "#00ff41" : "#ff3333";
  const statusIcon = container.status === "running" ? "●" : "✖";

  const className = selected
    ? styles.rowSelected
    : container.error
      ? styles.rowError
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
      <span style={{ color: statusColor, fontSize: 10 }}>{statusIcon}</span>
      <span style={{ color: container.managed === false ? "#005522" : "#00ff41", fontWeight: 600 }}>{container.name}</span>
      <span style={{ color: "#00aa30", fontSize: 11 }}>{container.image.length > 22 ? container.image.slice(0, 22) + "\u2026" : container.image}</span>
      <span style={{ color: statusColor, fontSize: 11, textTransform: "uppercase" }}>{container.status}</span>
      <ProgressBar value={container.cpu} danger={container.cpu > 80} />
      <span style={{ color: container.mem > 75 ? "#ffaa00" : "#00cc38", fontSize: 12 }}>{container.memMb}MB</span>
      <span style={{ color: "#007a22", fontSize: 11 }}>{container.uptime}</span>
    </div>
  );
}
