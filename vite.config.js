import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
  restartAllStacks,
  pullAllImages,
  dockerPrune,
  validateId,
} from './server/api.js';
import { startInvestigation, subscribeSession, getAgentStatus } from './server/agent/index.js';

// --- Vite plugin ---

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function systemInfoPlugin() {
  return {
    name: 'system-info-api',
    configureServer(server) {
      const json = (res, data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };

      // Existing endpoints
      server.middlewares.use('/api/system-info', (_req, res) => json(res, getSystemInfo()));
      server.middlewares.use('/api/system-stats', (_req, res) => json(res, getSystemStats()));
      server.middlewares.use('/api/docker-stats', (_req, res) => json(res, getDockerStats()));

      // New: stacks
      server.middlewares.use('/api/stacks', async (_req, res) => json(res, await getStacks()));

      // New: events
      server.middlewares.use('/api/events', (_req, res) => json(res, getDockerEvents()));

      // Aggregated container logs
      server.middlewares.use('/api/logs', async (_req, res) => json(res, await getAllContainerLogs()));

      // New: container endpoints (need URL parsing)
      server.middlewares.use(async (req, res, next) => {
        const url = req.url;

        // /api/container/:id/inspect
        const inspectMatch = url.match(/^\/api\/container\/([a-f0-9]+)\/inspect$/);
        if (inspectMatch) {
          const id = inspectMatch[1];
          if (!validateId(id)) {
            res.statusCode = 400;
            return json(res, { error: 'Invalid container ID' });
          }
          const data = getContainerInspect(id);
          if (data) return json(res, data);
          res.statusCode = 404;
          return json(res, { error: 'Container not found' });
        }

        // /api/container/:id/logs
        const logsMatch = url.match(/^\/api\/container\/([a-f0-9]+)\/logs$/);
        if (logsMatch) {
          const id = logsMatch[1];
          if (!validateId(id)) {
            res.statusCode = 400;
            return json(res, { error: 'Invalid container ID' });
          }
          return json(res, getContainerLogs(id));
        }

        // /api/container/:id/exec (POST)
        const execMatch = url.match(/^\/api\/container\/([a-f0-9]+)\/exec$/);
        if (execMatch && req.method === 'POST') {
          const id = execMatch[1];
          if (!validateId(id)) {
            res.statusCode = 400;
            return json(res, { error: 'Invalid container ID' });
          }
          const body = await readBody(req);
          return json(res, execInContainer(id, body.command));
        }

        // /api/container/:id/action (POST)
        const actionMatch = url.match(/^\/api\/container\/([a-f0-9]+)\/action$/);
        if (actionMatch && req.method === 'POST') {
          const id = actionMatch[1];
          if (!validateId(id)) {
            res.statusCode = 400;
            return json(res, { error: 'Invalid container ID' });
          }
          const body = await readBody(req);
          return json(res, containerAction(id, body.action));
        }

        // /api/stack/create (POST)
        if (url === '/api/stack/create' && req.method === 'POST') {
          const body = await readBody(req);
          return json(res, createStack(body.name, body.yaml, body.deploy === true));
        }

        // Bulk operations
        if (url === '/api/stacks/restart-all' && req.method === 'POST') {
          return json(res, restartAllStacks());
        }
        if (url === '/api/stacks/pull-all' && req.method === 'POST') {
          return json(res, pullAllImages());
        }
        if (url === '/api/stacks/prune' && req.method === 'POST') {
          return json(res, dockerPrune());
        }

        // /api/stack/:name/file (GET — read compose file)
        const fileGetMatch = url.match(/^\/api\/stack\/([a-zA-Z0-9][a-zA-Z0-9_.-]*)\/file$/);
        if (fileGetMatch && req.method === 'GET') {
          return json(res, getStackFile(fileGetMatch[1]));
        }

        // /api/stack/:name/file (PUT — update compose file)
        if (fileGetMatch && req.method === 'PUT') {
          const body = await readBody(req);
          return json(res, updateStackFile(fileGetMatch[1], body.yaml));
        }

        // /api/stack/:name/stream?action= (GET — SSE)
        const streamMatch = url.match(/^\/api\/stack\/([a-zA-Z0-9][a-zA-Z0-9_.-]*)\/stream\?action=(up|down|restart|stop)$/);
        if (streamMatch && req.method === 'GET') {
          const name = streamMatch[1];
          const action = streamMatch[2];
          const err = streamStackAction(name, action, res);
          if (err) return json(res, err);
          return; // SSE is streaming
        }

        // /api/stack/:name/action (POST)
        const stackActionMatch = url.match(/^\/api\/stack\/([a-zA-Z0-9][a-zA-Z0-9_.-]*)\/action$/);
        if (stackActionMatch && req.method === 'POST') {
          const name = stackActionMatch[1];
          const body = await readBody(req);
          return json(res, stackAction(name, body.action));
        }

        // --- AI Agent endpoints ---

        if (url === '/api/agent/status' && req.method === 'GET') {
          return json(res, getAgentStatus());
        }

        if (url === '/api/agent/investigate' && req.method === 'POST') {
          const body = await readBody(req);
          if (!body.container?.id || !body.container?.name) {
            res.statusCode = 400;
            return json(res, { error: 'Container id and name required' });
          }
          return json(res, startInvestigation(body.container, body.stackContext || null));
        }

        const agentStreamMatch = url.match(/^\/api\/agent\/stream\/([a-f0-9-]+)$/);
        if (agentStreamMatch && req.method === 'GET') {
          subscribeSession(agentStreamMatch[1], res);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), systemInfoPlugin()],
});
