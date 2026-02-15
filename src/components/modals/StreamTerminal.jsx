import { useState, useEffect, useRef } from 'react';
import styles from './StreamTerminal.module.css';

// Inline ANSI-to-HTML converter for Docker Compose output
const ANSI_MAP = {
  '1':  'font-weight:700',       // bold
  '2':  'opacity:0.7',           // dim
  '31': 'color:#ff3333',         // red
  '32': 'color:#00ff41',         // green
  '33': 'color:#ffaa00',         // yellow
  '34': 'color:#4488ff',         // blue
  '35': 'color:#ff66ff',         // magenta
  '36': 'color:#00cccc',         // cyan
  '37': 'color:#cccccc',         // white
  '90': 'color:#666666',         // bright black (gray)
};

function ansiToHtml(text) {
  // Strip carriage returns (progress bar partial lines)
  let cleaned = text.replace(/\r[^\n]/g, '');
  // Replace ANSI escape sequences with styled spans
  let result = '';
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === '\x1b' && cleaned[i + 1] === '[') {
      const end = cleaned.indexOf('m', i + 2);
      if (end !== -1) {
        const codes = cleaned.slice(i + 2, end).split(';');
        const styleList = [];
        for (const code of codes) {
          if (code === '0' || code === '') {
            result += '</span>';
            i = end + 1;
            continue;
          }
          if (ANSI_MAP[code]) styleList.push(ANSI_MAP[code]);
        }
        if (styleList.length > 0) {
          result += `<span style="${styleList.join(';')}">`;
        }
        i = end + 1;
        continue;
      }
    }
    // Escape HTML chars
    if (cleaned[i] === '<') result += '&lt;';
    else if (cleaned[i] === '>') result += '&gt;';
    else if (cleaned[i] === '&') result += '&amp;';
    else result += cleaned[i];
    i++;
  }
  return result;
}

export default function StreamTerminal({ stackName, action, onClose, onComplete }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState('connecting'); // connecting | streaming | done | error
  const [exitCode, setExitCode] = useState(null);
  const scrollRef = useRef(null);
  const esRef = useRef(null);

  useEffect(() => {
    const url = `/api/stack/${encodeURIComponent(stackName)}/stream?action=${action}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('start', () => {
      setStatus('streaming');
      setLines(prev => [...prev, { type: 'system', text: `>>> docker compose ${action} — ${stackName}` }]);
    });

    es.addEventListener('output', (e) => {
      try {
        const { stream, text } = JSON.parse(e.data);
        setLines(prev => [...prev, { type: stream, text }]);
      } catch {}
    });

    es.addEventListener('end', (e) => {
      try {
        const { code } = JSON.parse(e.data);
        setExitCode(code);
        const ok = code === 0;
        setStatus(ok ? 'done' : 'error');
        setLines(prev => [...prev, {
          type: ok ? 'success' : 'error',
          text: ok ? `\n✓ Operation completed successfully (exit 0)` : `\n✗ Operation failed (exit ${code})`,
        }]);
        if (onComplete) onComplete(ok);
      } catch {}
      es.close();
    });

    es.onerror = () => {
      if (status === 'connecting') {
        setStatus('error');
        setLines(prev => [...prev, { type: 'error', text: 'Failed to connect to stream' }]);
      }
      es.close();
    };

    return () => {
      es.close();
    };
  }, [stackName, action]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const finished = status === 'done' || status === 'error';

  const statusColor = {
    connecting: '#ffaa00',
    streaming: '#00ff41',
    done: '#00ff41',
    error: '#ff3333',
  }[status];

  const statusText = {
    connecting: 'CONNECTING',
    streaming: 'STREAMING',
    done: 'COMPLETED',
    error: 'FAILED',
  }[status];

  const lineClass = {
    stdout: styles.lineStdout,
    stderr: styles.lineStderr,
    system: styles.lineSystem,
    success: styles.lineSuccess,
    error: styles.lineError,
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.terminal}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.statusDot} style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            COMPOSE {action.toUpperCase()} — {stackName}
          </div>
          <div className={styles.headerRight}>
            <span className={styles.statusLabel} style={{ color: statusColor }}>{statusText}</span>
          </div>
        </div>

        <div ref={scrollRef} className={styles.output}>
          {lines.map((line, i) => (
            <div
              key={i}
              className={`${styles.line} ${lineClass[line.type] || styles.lineStdout}`}
              dangerouslySetInnerHTML={{ __html: ansiToHtml(line.text) }}
            />
          ))}
          {!finished && <span className={styles.cursor} />}
        </div>

        <div className={styles.footer}>
          <span style={{ color: '#007a22', fontSize: 11 }}>
            {finished ? `Exit code: ${exitCode ?? '?'}` : `PID streaming...`}
          </span>
          {finished ? (
            <button className={`${styles.closeBtn} ${status === 'error' ? styles.closeBtnDanger : ''}`} onClick={onClose}>
              CLOSE
            </button>
          ) : (
            <span style={{ color: '#007a22', fontSize: 10 }}>close when finished</span>
          )}
        </div>
      </div>
    </div>
  );
}
