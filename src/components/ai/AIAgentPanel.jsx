import { useState, useEffect, useRef } from 'react';
import { useAgentInvestigation } from '../../hooks/useAgentInvestigation';
import styles from './AIAgentPanel.module.css';

export default function AIAgentPanel({ containers, stacks, agentStatus }) {
  const { status, steps, diagnosis, meta, investigate, cancel } = useAgentInvestigation();
  const [targetContainer, setTargetContainer] = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll investigation log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  const problemContainers = (containers || []).filter(c => c.status !== 'running');

  const handleInvestigate = (container) => {
    setTargetContainer(container);
    // Find the stack this container belongs to
    const stack = stacks?.find(s => s.containers.some(c => c.id === container.id));
    const stackContext = stack ? {
      stackName: stack.name,
      managed: stack.managed,
      otherContainers: stack.containers.filter(c => c.id !== container.id).map(c => ({
        name: c.name,
        status: c.status,
      })),
    } : null;
    investigate(container, stackContext);
  };

  const configured = agentStatus?.configured === true;
  const isInvestigating = status === 'starting' || status === 'investigating';

  return (
    <div className={styles.container}>
      {/* Not configured state */}
      {!configured && (
        <div className={styles.analysisCard}>
          <div className={styles.title} style={{ color: 'var(--color-danger)' }}>
            AI AGENT — NOT CONFIGURED
          </div>
          <div className={styles.diagnosisItem} style={{ marginTop: 8 }}>
            {">"} Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable.
          </div>
          <div className={styles.diagnosisItem}>
            {">"} Optional: DOCKTERMINAL_LLM_PROVIDER=openai|anthropic
          </div>
        </div>
      )}

      {/* Idle state: show problem containers or all clear */}
      {configured && status === 'idle' && (
        problemContainers.length > 0 ? (
          <div className={styles.analysisCard}>
            <div className={styles.title}>
              {problemContainers.length} CONTAINER{problemContainers.length > 1 ? 'S' : ''} NOT RUNNING
            </div>
            <div className={styles.meta}>
              Click [INVESTIGATE] to start an AI-powered diagnosis.
            </div>
            {problemContainers.map(c => (
              <div key={c.id} className={styles.problemRow}>
                <div className={styles.problemInfo}>
                  <span className={styles.problemName}>{c.name}</span>
                  <span className={styles.problemStatus}>{c.status}</span>
                  <span className={styles.problemImage}>{c.image}</span>
                </div>
                <div
                  className={styles.investigateBtn}
                  onClick={() => handleInvestigate(c)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,65,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,65,0.05)'}
                >
                  [INVESTIGATE]
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.analysisCard}>
            <div className={styles.title} style={{ color: '#00ff41' }}>ALL SYSTEMS OPERATIONAL</div>
            <div className={styles.meta}>
              All containers are running. No issues detected.
            </div>
            <div className={styles.diagnosisItem} style={{ marginTop: 12 }}>
              {">"} AI agent ready — will investigate on demand
            </div>
          </div>
        )
      )}

      {/* Investigation running */}
      {configured && isInvestigating && (
        <div className={styles.analysisCard} style={{ borderColor: 'var(--color-primary)' }}>
          <div className={styles.title} style={{ color: 'var(--color-primary)' }}>
            INVESTIGATING: {targetContainer?.name}
          </div>
          {meta && (
            <div className={styles.meta}>
              Provider: {meta.provider?.toUpperCase()} / {meta.model}
            </div>
          )}
          <div className={styles.logArea} ref={scrollRef}>
            {steps.map((step, i) => (
              <StepLine key={i} step={step} />
            ))}
            <div className={styles.cursor}>_</div>
          </div>
          <div className={styles.actions}>
            <div
              className={styles.dismissBtn}
              onClick={cancel}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff6666'; e.currentTarget.style.color = '#ff6666'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#007a22'; e.currentTarget.style.color = '#007a22'; }}
            >
              [CANCEL]
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis complete */}
      {configured && status === 'done' && diagnosis && (
        <DiagnosisCard
          diagnosis={diagnosis}
          meta={meta}
          targetContainer={targetContainer}
          steps={steps}
          scrollRef={scrollRef}
          onNewInvestigation={() => {
            setTargetContainer(null);
            cancel();
          }}
        />
      )}

      {/* Error state */}
      {configured && status === 'error' && (
        <div className={styles.analysisCard} style={{ borderColor: 'var(--color-danger)' }}>
          <div className={styles.title} style={{ color: 'var(--color-danger)' }}>
            INVESTIGATION FAILED
          </div>
          <div className={styles.logArea} ref={scrollRef}>
            {steps.map((step, i) => (
              <StepLine key={i} step={step} />
            ))}
          </div>
          <div className={styles.actions}>
            <div
              className={styles.executeBtn}
              onClick={() => targetContainer && handleInvestigate(targetContainer)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,65,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,65,0.05)'}
            >
              [RETRY]
            </div>
            <div
              className={styles.dismissBtn}
              onClick={() => cancel()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00aa30'; e.currentTarget.style.color = '#00aa30'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#007a22'; e.currentTarget.style.color = '#007a22'; }}
            >
              [DISMISS]
            </div>
          </div>
        </div>
      )}

      {/* Status card */}
      <div className={styles.statusCard}>
        <div className={styles.statusTitle}>AI AGENT STATUS</div>
        <div className={styles.statusBody}>
          <div>Mode: <span style={{ color: '#00cc38' }}>INVESTIGATE + DIAGNOSE</span></div>
          <div>Provider: <span style={{ color: configured ? '#00cc38' : '#ff3333' }}>
            {configured
              ? `${agentStatus.provider?.toUpperCase()} / ${agentStatus.model}`
              : 'NOT CONFIGURED'}
          </span></div>
          <div>Auto-fix: <span style={{ color: '#ffaa00' }}>REQUIRES APPROVAL</span></div>
          <div>Status: <span style={{ color: configured ? '#00cc38' : '#ff3333' }}>
            {configured ? (isInvestigating ? 'INVESTIGATING...' : 'READY') : 'NOT CONFIGURED'}
          </span></div>
        </div>
      </div>
    </div>
  );
}

function StepLine({ step }) {
  switch (step.type) {
    case 'thinking':
      return <div className={styles.stepThinking}>[{step.content}]</div>;
    case 'reasoning':
      return <div className={styles.stepReasoning}>{">"} {step.content}</div>;
    case 'tool_call':
      return (
        <div className={styles.stepToolCall}>
          $ {step.tool}({formatArgs(step.arguments)})
        </div>
      );
    case 'tool_result':
      return (
        <div className={styles.stepToolResult}>
          {step.preview}
          {step.length > 500 && <span className={styles.truncated}> ({step.length} chars)</span>}
        </div>
      );
    case 'blocked':
      return <div className={styles.stepBlocked}>BLOCKED: {step.content}</div>;
    case 'warning':
      return <div className={styles.stepWarning}>WARNING: {step.content}</div>;
    case 'error':
      return <div className={styles.stepError}>ERROR: {step.content}</div>;
    default:
      return <div className={styles.diagnosisItem}>{">"} {step.content || JSON.stringify(step)}</div>;
  }
}

function DiagnosisCard({ diagnosis, meta, targetContainer, steps, scrollRef, onNewInvestigation }) {
  const [showSteps, setShowSteps] = useState(false);

  const severityColor = {
    critical: '#ff3333',
    high: '#ff6666',
    medium: '#ffaa00',
    low: '#00cc38',
  };

  return (
    <div className={styles.analysisCard}>
      <div className={styles.title}>{diagnosis.summary || 'DIAGNOSIS COMPLETE'}</div>
      <div className={styles.meta}>
        Container: <span style={{ color: '#ff6666' }}>{targetContainer?.name}</span>
        {meta && <> — {meta.iterations} iterations, {meta.execCalls} exec calls</>}
      </div>

      <div className={styles.sectionLabel}>ROOT CAUSE:</div>
      <div className={styles.diagnosisItem}>{">"} {diagnosis.rootCause}</div>

      {diagnosis.evidence.length > 0 && (
        <>
          <div className={styles.sectionLabel}>EVIDENCE:</div>
          {diagnosis.evidence.map((e, i) => (
            <div key={i} className={styles.diagnosisItem}>{">"} {e}</div>
          ))}
        </>
      )}

      <div className={styles.sectionLabel}>RECOMMENDED FIX:</div>
      <div className={styles.suggestion}>{">"} {diagnosis.fix}</div>

      <div className={styles.confidence}>
        SEVERITY: <span style={{ color: severityColor[diagnosis.severity] || '#ffaa00' }}>
          {(diagnosis.severity || 'medium').toUpperCase()}
        </span>
      </div>

      {/* Collapsible investigation log */}
      <div
        className={styles.toggleSteps}
        onClick={() => setShowSteps(!showSteps)}
      >
        [{showSteps ? '-' : '+'}] {showSteps ? 'HIDE' : 'SHOW'} INVESTIGATION LOG ({steps.length} steps)
      </div>
      {showSteps && (
        <div className={styles.logArea} ref={scrollRef}>
          {steps.map((step, i) => (
            <StepLine key={i} step={step} />
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <div
          className={styles.dismissBtn}
          onClick={onNewInvestigation}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00aa30'; e.currentTarget.style.color = '#00aa30'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#007a22'; e.currentTarget.style.color = '#007a22'; }}
        >
          [NEW INVESTIGATION]
        </div>
      </div>
    </div>
  );
}

function formatArgs(args) {
  if (!args) return '';
  const parts = [];
  for (const [k, v] of Object.entries(args)) {
    const val = typeof v === 'string' ? `"${v.length > 60 ? v.slice(0, 60) + '...' : v}"` : String(v);
    parts.push(`${k}=${val}`);
  }
  return parts.join(', ');
}
