import { useState, useEffect, useCallback } from 'react';

export function useContainerLogs(containerId, intervalMs = 5000) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(() => {
    if (containerId) {
      // Single container mode
      fetch(`/api/container/${containerId}/logs`)
        .then(r => r.json())
        .then(data => {
          setLogs(data.logs || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      // Aggregated mode: docker events
      fetch('/api/events')
        .then(r => r.json())
        .then(data => {
          setLogs(data.events || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [containerId]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
    const id = setInterval(fetchLogs, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, fetchLogs]);

  return { logs, loading };
}
