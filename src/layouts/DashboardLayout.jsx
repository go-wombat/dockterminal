import { useState, useEffect, useMemo } from 'react';
import CRTOverlay from '../components/ui/CRTOverlay';
import Header from '../components/header/Header';
import StatusBar from '../components/footer/StatusBar';
import BootScreen from '../components/boot/BootScreen';
import StatsBar from '../components/stats/StatsBar';
import TabBar from '../components/tabs/TabBar';
import Toolbar from '../components/toolbar/Toolbar';
import StacksPanel from '../components/stacks/StacksPanel';
import ComposeEditor from '../components/compose/ComposeEditor';
import LogsPanel from '../components/logs/LogsPanel';
import AIAgentPanel from '../components/ai/AIAgentPanel';
import DetailPanel from '../components/detail/DetailPanel';
import ShellTerminal from '../components/modals/ShellTerminal';
import StreamTerminal from '../components/modals/StreamTerminal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useClock } from '../hooks/useClock';
import { useSystemInfo } from '../hooks/useSystemInfo';
import { useSystemStats } from '../hooks/useSystemStats';
import { useDockerStacks } from '../hooks/useDockerStacks';
import { useContainerDetail } from '../hooks/useContainerDetail';
import { useContainerLogs } from '../hooks/useContainerLogs';
import styles from './DashboardLayout.module.css';

const TABS = ["STACKS", "LOGS", "AI AGENT"];

function generateAnalysis(containers) {
  const problems = containers.filter(c => c.status !== 'running');
  if (problems.length === 0) return null;

  const c = problems[0];
  return {
    title: "CONTAINER FAILURE ANALYSIS",
    container: c.name,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    diagnosis: [
      `Container "${c.name}" is ${c.status}`,
      c.status === 'exited' ? 'Process terminated — check exit code and logs' : `Container state: ${c.status}`,
      `Image: ${c.image}`,
      problems.length > 1 ? `${problems.length - 1} other container(s) also not running` : 'Only affected container in this scan',
    ],
    suggestion: `Inspect logs with: docker logs ${c.id} --tail 50. Consider restarting the container.`,
    confidence: 72,
    autofix: `docker restart ${c.id}`,
  };
}

export default function DashboardLayout() {
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [activeTab, setActiveTab] = useState("STACKS");
  const [rightTab, setRightTab] = useState("INFO");
  const [shellOpen, setShellOpen] = useState(false);
  const time = useClock();
  const { hostname } = useSystemInfo();
  const systemStats = useSystemStats(3000);
  const { stacks, containers, refresh: refreshStacks } = useDockerStacks(3000);
  const { detail: containerDetail, loading: detailLoading } = useContainerDetail(selectedContainer?.id);
  const { logs } = useContainerLogs(null, 5000);
  const [bootDone, setBootDone] = useState(false);
  const [bootStage, setBootStage] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null);
  const [expandedStacks, setExpandedStacks] = useState(new Set());
  const [logSearch, setLogSearch] = useState("");
  const [logLevels, setLogLevels] = useState({ INFO: true, WARN: true, ERR: true });
  const [actionResult, setActionResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null); // { stackName, yaml } or null
  const [newStackName, setNewStackName] = useState("");
  const [newStackYaml, setNewStackYaml] = useState("services:\n  app:\n    image: nginx:alpine\n    ports:\n      - \"8080:80\"\n    restart: unless-stopped\n");
  const [stackSearch, setStackSearch] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [streamingOp, setStreamingOp] = useState(null);

  // Auto-expand managed non-stopped stacks when data arrives
  useEffect(() => {
    if (stacks.length > 0) {
      setExpandedStacks(prev => {
        if (prev.size > 0) return prev;
        return new Set(stacks.filter(s => s.managed && s.status !== 'stopped').map(s => s.name));
      });
    }
  }, [stacks]);

  // Keep selectedContainer data fresh from polling
  useEffect(() => {
    if (selectedContainer && containers.length > 0) {
      const fresh = containers.find(c => c.id === selectedContainer.id);
      if (fresh && (fresh.cpu !== selectedContainer.cpu || fresh.mem !== selectedContainer.mem || fresh.status !== selectedContainer.status)) {
        setSelectedContainer(fresh);
      }
    }
  }, [containers, selectedContainer]);

  // Boot sequence
  useEffect(() => {
    const stages = [500, 800, 600, 700, 400];
    let current = 0;
    const advance = () => {
      if (current < stages.length) {
        setBootStage(current + 1);
        current++;
        setTimeout(advance, stages[current - 1]);
      } else {
        setBootDone(true);
      }
    };
    setTimeout(advance, 300);
  }, []);

  // Derived values (managed-only for header counters)
  const managedContainers = containers.filter(c => c.managed);
  const runningCount = managedContainers.filter(c => c.status === "running").length;
  const faultCount = managedContainers.filter(c => c.status !== "running").length;
  const stacksRunning = stacks.filter(s => s.status === "running").length;
  const stacksDegraded = stacks.filter(s => s.managed && s.status === "partial").length;

  const analysis = useMemo(() => generateAnalysis(containers), [containers]);

  const filteredLogs = logs.filter(log => {
    if (!logLevels[log.level]) return false;
    if (logSearch) {
      const s = logSearch.toLowerCase();
      return log.msg.toLowerCase().includes(s) || log.source.toLowerCase().includes(s);
    }
    return true;
  });

  const toggleLevel = (level) => {
    setLogLevels(prev => ({ ...prev, [level]: !prev[level] }));
  };

  const toggleStack = (name) => {
    setExpandedStacks(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleSelectContainer = (c) => {
    setSelectedContainer(c);
    setRightTab("INFO");
  };

  const handleAction = (action) => {
    if (selectedContainer?.managed === false) return;
    setConfirmAction({
      action,
      container: selectedContainer.name,
      containerId: selectedContainer.id,
      danger: action === "REMOVE",
    });
  };

  const handleStackAction = (stackName, action) => {
    setConfirmAction({
      action: action.toUpperCase(),
      container: stackName,
      isStack: true,
      stackName,
      danger: action === 'down',
    });
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;
    const { containerId, action } = confirmAction;
    try {
      const res = await fetch(`/api/container/${containerId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.toLowerCase() }),
      });
      const data = await res.json();
      if (data.error) {
        setActionResult({ ok: false, msg: data.error });
      } else {
        setActionResult({ ok: true, msg: `${action} executed successfully` });
        refreshStacks();
        if (action === 'REMOVE') setSelectedContainer(null);
      }
    } catch (err) {
      setActionResult({ ok: false, msg: err.message });
    }
    setConfirmAction(null);
    setTimeout(() => setActionResult(null), 3000);
  };

  const handleExecuteStackAction = () => {
    if (!confirmAction) return;
    const { stackName, action } = confirmAction;
    setConfirmAction(null);
    setStreamingOp({ stackName, action: action.toLowerCase() });
  };

  const handleExecuteFix = (fix) => {
    setConfirmAction({
      action: "EXECUTE AUTOFIX",
      container: fix.container,
      containerId: fix.autofix.match(/[a-f0-9]{12}/)?.[0] || '',
      danger: false,
      customCmd: fix.autofix,
    });
  };

  const handleExecuteAutofix = async () => {
    if (!confirmAction?.customCmd) return;
    try {
      // For autofix, we just restart the container via the action API
      const idMatch = confirmAction.customCmd.match(/[a-f0-9]{12}/);
      if (idMatch) {
        await fetch(`/api/container/${idMatch[0]}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restart' }),
        });
        refreshStacks();
      }
    } catch {}
    setConfirmAction(null);
  };

  // Toolbar bulk action handlers
  const handleRestartAll = () => {
    const runningStacks = stacks.filter(s => s.status !== 'stopped' && s.managed);
    setConfirmAction({
      action: "RESTART ALL STACKS",
      container: `${runningStacks.length} managed stack(s)`,
      danger: false,
      bulkAction: 'restart-all',
    });
  };

  const handlePullImages = () => {
    setConfirmAction({
      action: "PULL ALL IMAGES",
      container: "all managed stacks",
      danger: false,
      bulkAction: 'pull-all',
    });
  };

  const handlePrune = () => {
    setConfirmAction({
      action: "DOCKER SYSTEM PRUNE",
      container: "unused images, volumes, networks",
      danger: true,
      bulkAction: 'prune',
    });
  };

  const handleExecuteBulkAction = async () => {
    if (!confirmAction?.bulkAction) return;
    const endpoint = `/api/stacks/${confirmAction.bulkAction}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) {
        setActionResult({ ok: false, msg: data.error });
      } else if (data.warning) {
        setActionResult({ ok: true, msg: data.warning });
      } else {
        setActionResult({ ok: true, msg: `${confirmAction.action} completed successfully` });
      }
      refreshStacks();
    } catch (err) {
      setActionResult({ ok: false, msg: err.message });
    }
    setConfirmAction(null);
    setTimeout(() => setActionResult(null), 3000);
  };

  // Stack edit handlers
  const handleStackEdit = async (stackName) => {
    try {
      const res = await fetch(`/api/stack/${stackName}/file`);
      const data = await res.json();
      if (data.error) {
        setActionResult({ ok: false, msg: data.error });
        setTimeout(() => setActionResult(null), 3000);
        return;
      }
      setEditing({ stackName, yaml: data.yaml });
      setNewStackName(stackName);
      setNewStackYaml(data.yaml);
      setCreating(true);
      setActiveTab("STACKS");
    } catch (err) {
      setActionResult({ ok: false, msg: err.message });
      setTimeout(() => setActionResult(null), 3000);
    }
  };

  const handleSaveStack = async () => {
    if (!editing) return;
    setDeploying(true);
    try {
      const res = await fetch(`/api/stack/${editing.stackName}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: newStackYaml }),
      });
      const data = await res.json();
      if (data.error) {
        setActionResult({ ok: false, msg: data.error });
        setDeploying(false);
        setTimeout(() => setActionResult(null), 3000);
        return;
      }
      const restartName = editing.stackName;
      setCreating(false);
      setEditing(null);
      setNewStackName("");
      setNewStackYaml("services:\n  app:\n    image: nginx:alpine\n    ports:\n      - \"8080:80\"\n    restart: unless-stopped\n");
      setStreamingOp({ stackName: restartName, action: 'restart' });
    } catch (err) {
      setActionResult({ ok: false, msg: err.message });
      setTimeout(() => setActionResult(null), 3000);
    }
    setDeploying(false);
  };

  // Compose editor handlers
  const handleStartCompose = () => {
    setEditing(null);
    setCreating(true);
    setActiveTab("STACKS");
  };

  const handleDeploy = async () => {
    if (!newStackName) return;
    setDeploying(true);
    try {
      const res = await fetch('/api/stack/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStackName, yaml: newStackYaml, deploy: false }),
      });
      const data = await res.json();
      if (data.error) {
        setActionResult({ ok: false, msg: data.error });
        setDeploying(false);
        setTimeout(() => setActionResult(null), 3000);
        return;
      }
      // Files created — now stream the deploy
      const deployName = newStackName;
      setCreating(false);
      setNewStackName("");
      setNewStackYaml("services:\n  app:\n    image: nginx:alpine\n    ports:\n      - \"8080:80\"\n    restart: unless-stopped\n");
      setStreamingOp({ stackName: deployName, action: 'up' });
    } catch (err) {
      setActionResult({ ok: false, msg: err.message });
      setTimeout(() => setActionResult(null), 3000);
    }
    setDeploying(false);
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setEditing(null);
    setNewStackName("");
    setNewStackYaml("services:\n  app:\n    image: nginx:alpine\n    ports:\n      - \"8080:80\"\n    restart: unless-stopped\n");
  };

  // Stack filtering
  const filteredStacks = useMemo(() => {
    if (!stackSearch) return stacks;
    const s = stackSearch.toLowerCase();
    return stacks.filter(st => st.name.toLowerCase().includes(s) || st.containers.some(c => c.name.toLowerCase().includes(s)));
  }, [stacks, stackSearch]);

  if (!bootDone) {
    return <BootScreen bootStage={bootStage} />;
  }

  return (
    <div className={styles.layout}>
      <CRTOverlay />

      {shellOpen && selectedContainer && selectedContainer.status === "running" && (
        <ShellTerminal container={selectedContainer} onClose={() => setShellOpen(false)} />
      )}

      {streamingOp && (
        <StreamTerminal
          stackName={streamingOp.stackName}
          action={streamingOp.action}
          onClose={() => setStreamingOp(null)}
          onComplete={(ok) => {
            refreshStacks();
            if (!ok) setActionResult({ ok: false, msg: `Stack ${streamingOp.action} failed` });
          }}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          action={confirmAction.action}
          container={confirmAction.container}
          danger={confirmAction.danger}
          isStack={confirmAction.isStack}
          onExecute={confirmAction.bulkAction ? handleExecuteBulkAction : confirmAction.isStack ? handleExecuteStackAction : (confirmAction.customCmd ? handleExecuteAutofix : handleExecuteAction)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {actionResult && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', zIndex: 9999, fontSize: 12, fontFamily: 'inherit',
          border: `1px solid ${actionResult.ok ? '#00ff41' : '#ff3333'}`,
          color: actionResult.ok ? '#00ff41' : '#ff3333',
          background: actionResult.ok ? 'rgba(0,255,65,0.1)' : 'rgba(255,51,51,0.1)',
        }}>
          {actionResult.msg}
        </div>
      )}

      <Header
        runningCount={runningCount}
        faultCount={faultCount}
        stacksDegraded={stacksDegraded}
        time={time}
        nodeName={hostname}
      />

      <StatsBar
        stackCount={stacks.length}
        stacksRunning={stacksRunning}
        stacksDegraded={stacksDegraded}
        cpuPercent={systemStats.cpuPercent}
        physicalCores={systemStats.physicalCores}
        logicalCores={systemStats.logicalCores}
        usedMemMb={systemStats.usedMemMb}
        totalMemMb={systemStats.totalMemMb}
        dockerTotal={systemStats.dockerTotal}
        dockerRunning={systemStats.dockerRunning}
        dockerStopped={systemStats.dockerStopped}
      />

      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        faultCount={faultCount}
      />

      {activeTab === "STACKS" && (
        <Toolbar
          onCompose={handleStartCompose}
          onRestartAll={handleRestartAll}
          onPullImages={handlePullImages}
          onPrune={handlePrune}
          stackSearch={stackSearch}
          onStackSearchChange={setStackSearch}
        />
      )}

      <div className={styles.mainContent}>
        <div className={styles.leftPanel}>
          {activeTab === "STACKS" && (
            creating ? (
              <ComposeEditor
                stackName={newStackName}
                onStackNameChange={setNewStackName}
                yaml={newStackYaml}
                onYamlChange={setNewStackYaml}
                onDeploy={editing ? handleSaveStack : handleDeploy}
                onCancel={handleCancelCreate}
                deploying={deploying}
                editMode={!!editing}
              />
            ) : (
              <StacksPanel
                stacks={filteredStacks}
                expandedStacks={expandedStacks}
                onToggleStack={toggleStack}
                selectedContainerId={selectedContainer?.id}
                onSelectContainer={handleSelectContainer}
                onStackAction={handleStackAction}
                onStackEdit={handleStackEdit}
                activeStreamingStack={streamingOp?.stackName || null}
              />
            )
          )}

          {activeTab === "LOGS" && (
            <LogsPanel
              logs={filteredLogs}
              totalCount={logs.length}
              logSearch={logSearch}
              onSearchChange={setLogSearch}
              logLevels={logLevels}
              onToggleLevel={toggleLevel}
            />
          )}

          {activeTab === "AI AGENT" && (
            <AIAgentPanel
              analysis={analysis}
              onExecuteFix={handleExecuteFix}
            />
          )}
        </div>

        <DetailPanel
          container={selectedContainer}
          containerDetail={containerDetail}
          detailLoading={detailLoading}
          rightTab={rightTab}
          onRightTabChange={setRightTab}
          onOpenShell={() => setShellOpen(true)}
          onAction={handleAction}
        />
      </div>

      <StatusBar />
    </div>
  );
}
