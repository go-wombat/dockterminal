import { useState } from 'react';
import ActionBtn from '../ui/ActionBtn';
import styles from './DetailPanel.module.css';

const SENSITIVE_RE = /password|passwd|secret|token|api.?key|private.?key|credential|auth|jwt|session|cookie|encryption|signing/i;

export default function DetailPanel({ container, containerDetail, detailLoading, rightTab, onRightTabChange, onOpenShell, onAction }) {
  if (!container) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⬡</div>
          <div className={styles.emptyText}>SELECT CONTAINER</div>
        </div>
      </div>
    );
  }

  const infoRows = [
    ["ID", container.id],
    ["IMAGE", container.image],
    ["STATUS", container.status.toUpperCase()],
    ["HEALTH", container.health],
    ["CPU", `${container.cpu}%`],
    ["MEMORY", `${container.memMb}MB (${container.mem}%)`],
    ["PORTS", container.ports],
    ["UPTIME", container.uptime],
  ];

  // Add extra info from inspect
  if (containerDetail) {
    if (containerDetail.restartPolicy?.Name) {
      infoRows.push(["RESTART", containerDetail.restartPolicy.Name]);
    }
    if (containerDetail.state?.StartedAt) {
      infoRows.push(["STARTED", containerDetail.state.StartedAt.replace('T', ' ').slice(0, 19)]);
    }
    const netNames = containerDetail.networks ? Object.keys(containerDetail.networks) : [];
    if (netNames.length > 0) {
      const netInfo = netNames.map(n => {
        const ip = containerDetail.networks[n].IPAddress;
        return ip ? `${n} (${ip})` : n;
      }).join(', ');
      infoRows.push(["NETWORKS", netInfo]);
    }
    if (containerDetail.config?.WorkingDir) {
      infoRows.push(["WORKDIR", containerDetail.config.WorkingDir]);
    }
  }

  const envVars = containerDetail?.env || [];
  const mounts = containerDetail?.mounts || [];
  const [revealedKeys, setRevealedKeys] = useState(new Set());

  return (
    <div className={styles.panel}>
      <div style={{ animation: "fadeIn 0.2s ease" }}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {(container.managed === false ? ["INFO", "VOLUMES"] : ["INFO", "ENV", "VOLUMES"]).map(tab => (
            <div
              key={tab}
              onClick={() => onRightTabChange(tab)}
              className={styles.tab}
              style={{
                color: rightTab === tab ? "#00ff41" : "#007a22",
                borderBottom: rightTab === tab ? "1px solid #00ff41" : "1px solid transparent",
                background: rightTab === tab ? "rgba(0,255,65,0.03)" : "transparent",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className={styles.content}>
          <div className={styles.containerName}>{container.name}</div>

          {container.managed === false && (
            <div style={{
              padding: '4px 10px',
              marginBottom: 10,
              fontSize: 10,
              fontWeight: 700,
              color: '#005522',
              border: '1px solid #003310',
              background: 'rgba(0,85,34,0.08)',
              letterSpacing: 1,
            }}>
              [EXTERNAL — READ ONLY]
            </div>
          )}

          {rightTab === "INFO" && (
            <>
              {infoRows.map(([k, v]) => (
                <div key={k} className={styles.infoRow}>
                  <span style={{ color: "#007a22" }}>{k}</span>
                  <span title={v} style={{
                    color: (k === "STATUS" && v === "EXITED") || (k === "HEALTH" && (v === "FAULT" || v === "unhealthy")) ? "#ff3333" : "#00ff41",
                    fontWeight: k === "STATUS" || k === "HEALTH" ? 700 : 400,
                  }}>{v}</span>
                </div>
              ))}
              {containerDetail?.state?.ExitCode > 0 && container.status !== 'running' && (
                <div className={styles.errorBox}>
                  <div className={styles.errorTitle}>EXIT INFO</div>
                  <div className={styles.errorText}>
                    Exit code: {containerDetail.state.ExitCode}
                    {containerDetail.state.OOMKilled && ' (OOMKilled)'}
                    {containerDetail.state.Error && ` — ${containerDetail.state.Error}`}
                  </div>
                </div>
              )}
            </>
          )}

          {rightTab === "ENV" && (
            <div style={{ fontSize: 11 }}>
              {detailLoading && <div style={{ color: '#007a22' }}>Loading...</div>}
              {!detailLoading && envVars.length === 0 && (
                <div style={{ color: '#007a22' }}>No environment variables</div>
              )}
              {envVars.map(([k, v]) => {
                const sensitive = SENSITIVE_RE.test(k);
                const masked = sensitive && !revealedKeys.has(k);
                return (
                  <div key={k} className={styles.envRow}>
                    <span style={{ color: "#007a22" }}>
                      {sensitive && <span style={{ color: "#553333", marginRight: 4 }}>●</span>}
                      {k}
                    </span>
                    <span
                      style={{
                        color: masked ? "#003310" : "#00cc38",
                        cursor: sensitive ? "pointer" : "default",
                        letterSpacing: masked ? 2 : 0,
                      }}
                      onClick={sensitive ? () => setRevealedKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(k)) next.delete(k); else next.add(k);
                        return next;
                      }) : undefined}
                      title={sensitive ? (masked ? "Click to reveal" : "Click to hide") : v}
                    >
                      {masked ? "••••••••" : v}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {rightTab === "VOLUMES" && (
            <div style={{ fontSize: 11 }}>
              {detailLoading && <div style={{ color: '#007a22' }}>Loading...</div>}
              {!detailLoading && mounts.length === 0 && (
                <div style={{ color: '#007a22' }}>No volumes mounted</div>
              )}
              {mounts.map((m, i) => (
                <div key={i} className={styles.volumeRow}>
                  <div style={{ color: "#00ff41" }}>{m.destination}</div>
                  <div style={{ color: "#007a22", fontSize: 10 }}>{"\u2192"} {m.source} ({m.type}, {m.mode})</div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons — hidden for unmanaged (external) containers */}
          {container.managed !== false && (
            <div className={styles.actions}>
              <ActionBtn label="> OPEN SHELL" title="OPEN SHELL" color="#00ff41" disabled={container.status !== "running"} onClick={onOpenShell} />

              <div className={styles.actionGrid}>
                {["RESTART", "STOP", "START", "REMOVE"].map(action => {
                  const disabled = (action === "START" && container.status === "running")
                    || (action === "STOP" && container.status !== "running");
                  return (
                    <ActionBtn
                      key={action}
                      label={`[${action}]`}
                      title={action}
                      color={action === "REMOVE" ? "#ff3333" : "#00aa30"}
                      disabled={disabled}
                      onClick={() => onAction(action)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
