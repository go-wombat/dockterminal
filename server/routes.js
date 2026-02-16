import { Router } from 'express';
import {
  getSystemInfo,
  getSystemStats,
  getDockerStats,
  getStacks,
  getDockerEvents,
  getAllContainerLogs,
  getContainerInspect,
  getContainerLogs,
  execInContainer,
  containerAction,
  stackAction,
  streamStackAction,
  createStack,
  getStackFile,
  updateStackFile,
  getStackEnvFile,
  updateStackEnvFile,
  restartAllStacks,
  pullAllImages,
  dockerPrune,
  validateId,
} from './api.js';
import { startInvestigation, subscribeSession, getAgentStatus } from './agent/index.js';

const router = Router();

// Health check
router.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// System endpoints
router.get('/api/system-info', (_req, res) => res.json(getSystemInfo()));
router.get('/api/system-stats', (_req, res) => res.json(getSystemStats()));
router.get('/api/docker-stats', (_req, res) => res.json(getDockerStats()));

// Stacks & events
router.get('/api/stacks', async (_req, res) => res.json(await getStacks()));
router.get('/api/events', (_req, res) => res.json(getDockerEvents()));
router.get('/api/logs', async (_req, res) => res.json(await getAllContainerLogs()));

// Container endpoints
router.get('/api/container/:id/inspect', (req, res) => {
  const { id } = req.params;
  if (!validateId(id)) return res.status(400).json({ error: 'Invalid container ID' });
  const data = getContainerInspect(id);
  if (!data) return res.status(404).json({ error: 'Container not found' });
  res.json(data);
});

router.get('/api/container/:id/logs', (req, res) => {
  const { id } = req.params;
  if (!validateId(id)) return res.status(400).json({ error: 'Invalid container ID' });
  res.json(getContainerLogs(id));
});

router.post('/api/container/:id/exec', (req, res) => {
  const { id } = req.params;
  if (!validateId(id)) return res.status(400).json({ error: 'Invalid container ID' });
  res.json(execInContainer(id, req.body.command));
});

router.post('/api/container/:id/action', (req, res) => {
  const { id } = req.params;
  if (!validateId(id)) return res.status(400).json({ error: 'Invalid container ID' });
  res.json(containerAction(id, req.body.action));
});

// Stack file read/update
router.get('/api/stack/:name/file', (req, res) => {
  const { name } = req.params;
  res.json(getStackFile(name));
});

router.put('/api/stack/:name/file', (req, res) => {
  const { name } = req.params;
  const result = updateStackFile(name, req.body.yaml);
  if (result.ok && req.body.env !== undefined) {
    updateStackEnvFile(name, req.body.env);
  }
  res.json(result);
});

// Stack .env read/update
router.get('/api/stack/:name/env', (req, res) => {
  const { name } = req.params;
  res.json(getStackEnvFile(name));
});

router.put('/api/stack/:name/env', (req, res) => {
  const { name } = req.params;
  res.json(updateStackEnvFile(name, req.body.env));
});

// Stack streaming (SSE)
router.get('/api/stack/:name/stream', (req, res) => {
  const { name } = req.params;
  const action = req.query.action;
  const err = streamStackAction(name, action, res);
  if (err) return res.json(err);
  // SSE is streaming — no res.json()
});

// Stack actions
router.post('/api/stack/:name/action', (req, res) => {
  const { name } = req.params;
  res.json(stackAction(name, req.body.action));
});

// Stack creation
router.post('/api/stack/create', (req, res) => {
  const { name, yaml, deploy, env } = req.body;
  res.json(createStack(name, yaml, deploy === true, env || ''));
});

// Bulk operations
router.post('/api/stacks/restart-all', (_req, res) => res.json(restartAllStacks()));
router.post('/api/stacks/pull-all', (_req, res) => res.json(pullAllImages()));
router.post('/api/stacks/prune', (_req, res) => res.json(dockerPrune()));

// AI Agent endpoints
router.get('/api/agent/status', (_req, res) => res.json(getAgentStatus()));

router.post('/api/agent/investigate', (req, res) => {
  const { container, stackContext } = req.body;
  if (!container?.id || !container?.name) {
    return res.status(400).json({ error: 'Container id and name required' });
  }
  const result = startInvestigation(container, stackContext || null);
  res.json(result);
});

router.get('/api/agent/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  subscribeSession(sessionId, res);
});

export default router;
