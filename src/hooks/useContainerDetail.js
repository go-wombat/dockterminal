import { useState, useEffect } from 'react';

export function useContainerDetail(containerId) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!containerId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    fetch(`/api/container/${containerId}/inspect`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(() => {
        setDetail(null);
        setLoading(false);
      });
  }, [containerId]);

  return { detail, loading };
}
