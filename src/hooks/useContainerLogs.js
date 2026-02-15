import { useState, useEffect, useCallback } from 'react';

export function useContainerLogs(containerId, intervalMs = 5000, enabled = true) {
  const [logs, setLogs] = useState([]);

  const fetchLogs = useCallback(() => {
    if (!enabled) return;
    if (containerId) {
      // Single container mode
      fetch(`/api/container/${containerId}/logs`)
        .then(r => r.json())
        .then(data => {
          setLogs(data.logs || []);
        })
        .catch(() => {});
    } else {
      // Aggregated mode: all container logs
      fetch('/api/logs')
        .then(r => r.json())
        .then(data => {
          setLogs(data.logs || []);
        })
        .catch(() => {});
    }
  }, [containerId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      return;
    }
    fetchLogs();
    const id = setInterval(fetchLogs, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, fetchLogs, enabled]);

  return { logs };
}
