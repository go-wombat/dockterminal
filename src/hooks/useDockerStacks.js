import { useState, useEffect, useCallback } from 'react';

export function useDockerStacks(intervalMs = 3000) {
  const [stacks, setStacks] = useState([]);

  const fetchStacks = useCallback(() => {
    fetch('/api/stacks')
      .then(r => r.json())
      .then(data => {
        setStacks(data.stacks || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStacks();
    const id = setInterval(fetchStacks, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, fetchStacks]);

  const containers = stacks.flatMap(s => s.containers);

  return { stacks, containers, refresh: fetchStacks };
}
