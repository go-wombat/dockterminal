import ContainerRow from './ContainerRow';
import ActionBtn from '../ui/ActionBtn';
import styles from './StackGroup.module.css';

export default function StackGroup({ stack, index, expanded, onToggle, selectedContainerId, onSelectContainer, onStackAction, onStackEdit, isStreaming }) {
  const running = stack.containers.filter(c => c.status === "running").length;
  const total = stack.containers.length;
  const isManaged = stack.managed !== false;
  const isStandalone = stack.name === 'standalone';
  const showActions = isManaged && !isStandalone && onStackAction && !isStreaming;
  const isUp = stack.status === 'running' || stack.status === 'partial';
  const statusColor = !isManaged ? "#005522" : stack.status === "running" ? "#00ff41" : stack.status === "partial" ? "#ffaa00" : "#555";
  const statusIcon = stack.status === "running" ? "●" : stack.status === "partial" ? "⚠" : "○";

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
        <span style={{ color: statusColor, fontSize: 11, textTransform: "uppercase" }}>{stack.status === "partial" ? "DEGRADED" : stack.status}</span>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          {showActions && isUp && (
            <>
              <ActionBtn label="⟳" title="RESTART STACK" color="#ffaa00" onClick={() => onStackAction(stack.name, 'restart')} />
              <ActionBtn label="■" title="STOP STACK" color="#ff3333" onClick={() => onStackAction(stack.name, 'down')} />
            </>
          )}
          {showActions && !isUp && (
            <ActionBtn label="▶" title="START STACK" color="#00ff41" onClick={() => onStackAction(stack.name, 'up')} />
          )}
          {isManaged && !isStandalone && onStackEdit && !isStreaming && (
            <ActionBtn label="✎" title="EDIT COMPOSE" onClick={() => onStackEdit(stack.name)} />
          )}
          {isStreaming && <span style={{ color: '#ffaa00', fontSize: 9, animation: 'blink 1s step-end infinite' }}>● RUNNING...</span>}
        </div>
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
