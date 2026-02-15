import { useState, useEffect } from 'react';

const DEFAULTS = {
  cpuPercent: 0,
  physicalCores: 0,
  logicalCores: 0,
  totalMemMb: 0,
  usedMemMb: 0,
  loadAvg: ['0.00', '0.00', '0.00'],
  dockerTotal: 0,
  dockerRunning: 0,
  dockerStopped: 0,
};

export function useSystemStats(intervalMs = 3000) {
  const [stats, setStats] = useState(DEFAULTS);

  useEffect(() => {
    let active = true;

    const fetchStats = () => {
      Promise.all([
        fetch('/api/system-stats').then(r => r.json()),
        fetch('/api/docker-stats').then(r => r.json()),
      ])
        .then(([sys, docker]) => {
          if (active) {
            setStats({
              ...sys,
              dockerTotal: docker.total,
              dockerRunning: docker.running,
              dockerStopped: docker.stopped,
            });
          }
        })
        .catch(() => {});
    };

    fetchStats();
    const id = setInterval(fetchStats, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [intervalMs]);

  return stats;
}
