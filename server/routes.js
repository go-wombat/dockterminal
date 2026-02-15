import { Router } from 'express';
import {
  getSystemInfo,
  getSystemStats,
  getDockerStats,
  getStacks,
  getDockerEvents,
  getContainerInspect,
  getContainerLogs,
  execInContainer,
  containerAction,
  stackAction,
  streamStackAction,
  createStack,
  getStackFile,
  updateStackFile,
  restartAllStacks,
  pullAllImages,
  dockerPrune,
  validateId,
} from './api.js';

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
router.get('/api/stacks', (_req, res) => res.json(getStacks()));
router.get('/api/events', (_req, res) => res.json(getDockerEvents()));

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
  res.json(updateStackFile(name, req.body.yaml));
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
  const { name, yaml, deploy } = req.body;
  res.json(createStack(name, yaml, deploy === true));
});

// Bulk operations
router.post('/api/stacks/restart-all', (_req, res) => res.json(restartAllStacks()));
router.post('/api/stacks/pull-all', (_req, res) => res.json(pullAllImages()));
router.post('/api/stacks/prune', (_req, res) => res.json(dockerPrune()));

export default router;
