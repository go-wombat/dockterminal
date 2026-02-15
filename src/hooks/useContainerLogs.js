import { useState, useEffect, useCallback } from 'react';

export function useContainerLogs(containerId, intervalMs = 5000) {
  const [logs, setLogs] = useState([]);

  const fetchLogs = useCallback(() => {
    if (containerId) {
      // Single container mode
      fetch(`/api/container/${containerId}/logs`)
        .then(r => r.json())
        .then(data => {
          setLogs(data.logs || []);
        })
        .catch(() => {});
    } else {
      // Aggregated mode: docker events
      fetch('/api/events')
        .then(r => r.json())
        .then(data => {
          setLogs(data.events || []);
        })
        .catch(() => {});
    }
  }, [containerId]);

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, fetchLogs]);

  return { logs };
}
