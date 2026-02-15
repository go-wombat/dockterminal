import { useState, useEffect } from 'react';

const DEFAULTS = {
  hostname: 'unknown',
  hostOs: 'Unknown OS',
  dockerVersion: 'N/A',
  composeVersion: 'N/A',
};

export function useSystemInfo() {
  const [info, setInfo] = useState(DEFAULTS);

  useEffect(() => {
    fetch('/api/system-info')
      .then(r => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  return info;
}
