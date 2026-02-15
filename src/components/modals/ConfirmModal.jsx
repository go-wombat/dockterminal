import styles from './ConfirmModal.module.css';

export default function ConfirmModal({ action, container, danger, isStack, onExecute, onCancel }) {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.modal}
        style={{
          border: `1px solid ${danger ? "#ff3333" : "#00ff41"}`,
          boxShadow: `0 0 30px ${danger ? "rgba(255,51,51,0.2)" : "rgba(0,255,65,0.15)"}`,
        }}
      >
        <div className={styles.title} style={{ color: danger ? "#ff3333" : "#ffaa00" }}>
          ⚠ CONFIRM: {action}
        </div>
        <div className={styles.containerName}>
          {isStack ? 'Stack' : 'Container'}: <span style={{ color: "#00ff41" }}>{container}</span>
        </div>
        <div className={styles.description}>
          {danger
            ? isStack ? "This will stop and remove all containers in the stack." : "This action is destructive and cannot be undone."
            : isStack ? "This will affect all containers in the stack." : "This will affect the running container."}
        </div>
        <div className={styles.buttons}>
          <div
            onClick={onExecute}
            className={styles.executeBtn}
            style={{
              border: `1px solid ${danger ? "#ff3333" : "#00ff41"}`,
              color: danger ? "#ff3333" : "#00ff41",
              background: danger ? "rgba(255,51,51,0.05)" : "rgba(0,255,65,0.05)",
            }}
          >
            [EXECUTE]
          </div>
          <div onClick={onCancel} className={styles.cancelBtn}>
            [CANCEL]
          </div>
        </div>
      </div>
    </div>
  );
}
