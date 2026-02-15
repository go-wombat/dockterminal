import ContainerRow from './ContainerRow';
import styles from './StackGroup.module.css';

export default function StackGroup({ stack, index, expanded, onToggle, selectedContainerId, onSelectContainer, onStackAction }) {
  const running = stack.containers.filter(c => c.status === "running").length;
  const total = stack.containers.length;
  const isManaged = stack.managed !== false;
  const isStandalone = stack.name === 'standalone';
  const showActions = isManaged && !isStandalone && onStackAction;
  const isUp = stack.status === 'running' || stack.status === 'partial';
  const statusColor = !isManaged ? "#005522" : stack.status === "running" ? "#00ff41" : stack.status === "partial" ? "#ffaa00" : "#555";
  const statusIcon = stack.status === "running" ? "●" : stack.status === "partial" ? "⚠" : "○";

  const actionBtn = (label, action, color) => (
    <span
      onClick={(e) => { e.stopPropagation(); onStackAction(stack.name, action); }}
      style={{
        color, fontSize: 9, cursor: 'pointer', padding: '2px 4px',
        border: `1px solid ${color}`, opacity: 0.8,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
    >
      {label}
    </span>
  );

  return (
    <div style={{ animation: `fadeIn 0.3s ease ${index * 0.04}s both` }}>
      <div
        onClick={onToggle}
        className={stack.status === "partial" ? styles.headerPartial : styles.header}
      >
        <span style={{
          color: "#007a22",
          fontSize: 10,
          display: "inline-block",
          transition: "transform 0.2s",
          transform: expanded ? "rotate(90deg)" : "rotate(0)",
        }}>▶</span>
        <span style={{ color: statusColor, fontWeight: 700 }}>
          {statusIcon} {stack.name}
          {!isManaged && <span style={{ color: "#005522", fontWeight: 400, fontSize: 9, marginLeft: 6 }}>[EXTERNAL]</span>}
          <span style={{ color: "#007a22", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>{running}/{total}</span>
        </span>
        <span style={{ color: "#007a22", fontSize: 11 }}>{stack.path}</span>
        <span style={{ color: statusColor, fontSize: 11, textTransform: "uppercase" }}>{stack.status === "partial" ? "DEGRADED" : stack.status}</span>
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {showActions && isUp && actionBtn('▼ DOWN', 'down', '#ff3333')}
        </span>
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {showActions && isUp && actionBtn('↻ RESTART', 'restart', '#ffaa00')}
        </span>
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {showActions && !isUp && actionBtn('▲ UP', 'up', '#00ff41')}
        </span>
      </div>

      {expanded && (
        <>
          <div className={styles.columnHeaders}>
            <span></span><span>CONTAINER</span><span>IMAGE</span><span>STATE</span><span>CPU</span><span>MEMORY</span><span>UPTIME</span>
          </div>
          {stack.containers.map((c, i) => (
            <div key={c.id} style={{ animation: `fadeIn 0.15s ease ${i * 0.03}s both` }}>
              <ContainerRow
                container={c}
                selected={selectedContainerId === c.id}
                onClick={() => onSelectContainer(c)}
                indent
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
