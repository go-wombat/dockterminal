import { useState, useCallback, useRef } from 'react';

/**
 * SSE consumer hook for AI agent investigations.
 * State: { status, steps[], diagnosis, meta, investigate(), cancel() }
 */
export function useAgentInvestigation() {
  const [status, setStatus] = useState('idle'); // idle | starting | investigating | done | error
  const [steps, setSteps] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [meta, setMeta] = useState(null);
  const eventSourceRef = useRef(null);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
  }, []);

  const investigate = useCallback(async (container, stackContext) => {
    // Reset state
    setStatus('starting');
    setSteps([]);
    setDiagnosis(null);
    setMeta(null);

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Step 1: POST to start investigation
      const res = await fetch('/api/agent/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container, stackContext }),
      });

      if (!res.ok) {
        const data = await res.json();
        setStatus('error');
        setSteps([{ type: 'error', content: data.error || 'Failed to start investigation' }]);
        return;
      }

      const { sessionId } = await res.json();

      // Step 2: Connect EventSource
      setStatus('investigating');
      const es = new EventSource(`/api/agent/stream/${sessionId}`);
      eventSourceRef.current = es;

      es.addEventListener('start', (e) => {
        const data = JSON.parse(e.data);
        setMeta(data);
      });

      es.addEventListener('step', (e) => {
        const data = JSON.parse(e.data);
        setSteps(prev => [...prev, data]);
      });

      es.addEventListener('diagnosis', (e) => {
        const data = JSON.parse(e.data);
        setDiagnosis(parseDiagnosis(data.raw));
      });

      es.addEventListener('end', (e) => {
        const data = JSON.parse(e.data);
        setMeta(prev => ({ ...prev, ...data }));
        setStatus('done');
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener('error', (e) => {
        // SSE error event — could be a structured error from our server
        try {
          const data = JSON.parse(e.data);
          setSteps(prev => [...prev, { type: 'error', content: data.message || 'Unknown error' }]);
        } catch {
          // Browser-level SSE error (connection lost)
        }
        setStatus('error');
        es.close();
        eventSourceRef.current = null;
      });

      // Handle browser-level connection errors
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          // Already closed, expected
          return;
        }
        setStatus('error');
        setSteps(prev => [...prev, { type: 'error', content: 'Connection to agent lost' }]);
        es.close();
        eventSourceRef.current = null;
      };

    } catch (err) {
      setStatus('error');
      setSteps([{ type: 'error', content: err.message }]);
    }
  }, []);

  return { status, steps, diagnosis, meta, investigate, cancel };
}

/**
 * Parse the LLM's structured diagnosis text into an object.
 */
function parseDiagnosis(raw) {
  if (!raw) return { summary: 'No diagnosis produced', raw: '' };

  const lines = raw.split('\n');
  const result = {
    summary: '',
    rootCause: '',
    evidence: [],
    fix: '',
    severity: 'medium',
    raw,
  };

  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith('DIAGNOSIS:')) {
      result.summary = line.replace('DIAGNOSIS:', '').trim();
      currentSection = null;
    } else if (line.startsWith('ROOT CAUSE:')) {
      result.rootCause = line.replace('ROOT CAUSE:', '').trim();
      currentSection = 'rootCause';
    } else if (line.startsWith('EVIDENCE:')) {
      currentSection = 'evidence';
    } else if (line.startsWith('RECOMMENDED FIX:')) {
      result.fix = line.replace('RECOMMENDED FIX:', '').trim();
      currentSection = 'fix';
    } else if (line.startsWith('SEVERITY:')) {
      result.severity = line.replace('SEVERITY:', '').trim().toLowerCase();
      currentSection = null;
    } else if (line.trim()) {
      // Continuation line
      if (currentSection === 'evidence') {
        result.evidence.push(line.replace(/^[-*]\s*/, '').trim());
      } else if (currentSection === 'rootCause') {
        result.rootCause += ' ' + line.trim();
      } else if (currentSection === 'fix') {
        result.fix += ' ' + line.trim();
      }
    }
  }

  return result;
}
