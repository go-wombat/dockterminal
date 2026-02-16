// Agent loop orchestration + SSE streaming.
import { randomUUID } from 'crypto';
import { getProviderConfig, createAdapter } from './providers.js';
import { executeTool, isExecTool } from './tools.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';

const MAX_ITERATIONS = 15;
const MAX_EXEC_CALLS = 5;
const TOTAL_TIMEOUT_MS = 60000;
const TOOL_RESULT_PREVIEW = 500;

// In-flight sessions: sessionId -> { container, stackContext, status, events[] }
const sessions = new Map();

// Clean up old sessions after 5 minutes
// .unref() so this timer doesn't prevent process exit (e.g. during vite build)
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
}, 60000).unref();

/**
 * Start an investigation session. Returns { sessionId }.
 */
export function startInvestigation(container, stackContext) {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    container,
    stackContext,
    status: 'pending',
    events: [],
    listeners: new Set(),
    createdAt: Date.now(),
  });

  // Run the agent loop asynchronously
  runAgentLoop(sessionId).catch(err => {
    const session = sessions.get(sessionId);
    if (session) {
      pushEvent(session, 'error', { message: err.message });
      pushEvent(session, 'end', {});
      session.status = 'error';
    }
  });

  return { sessionId };
}

/**
 * Subscribe to SSE events for a session. Sends all buffered events then streams new ones.
 */
export function subscribeSession(sessionId, res) {
  const session = sessions.get(sessionId);
  if (!session) {
    res.writeHead(404);
    res.end('Session not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send all buffered events
  for (const event of session.events) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  // If session already ended, close connection
  if (session.status === 'done' || session.status === 'error') {
    res.end();
    return;
  }

  // Listen for new events
  const listener = (event) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      if (event.type === 'end' || event.type === 'error') {
        res.end();
        session.listeners.delete(listener);
      }
    } catch {
      session.listeners.delete(listener);
    }
  };

  session.listeners.add(listener);
  res.on('close', () => session.listeners.delete(listener));
}

function pushEvent(session, type, data) {
  const event = { type, data: { ...data, ts: Date.now() } };
  session.events.push(event);
  for (const listener of session.listeners) {
    listener(event);
  }
}

async function runAgentLoop(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.status = 'running';

  const config = getProviderConfig();
  if (!config) {
    pushEvent(session, 'error', { message: 'No LLM provider configured' });
    pushEvent(session, 'end', {});
    session.status = 'error';
    return;
  }

  pushEvent(session, 'start', {
    provider: config.provider,
    model: config.model,
    container: session.container.name,
  });

  let adapter;
  try {
    adapter = await createAdapter(config);
  } catch (err) {
    pushEvent(session, 'error', { message: `Failed to initialize ${config.provider}: ${err.message}` });
    pushEvent(session, 'end', {});
    session.status = 'error';
    return;
  }

  const userPrompt = buildUserPrompt(session.container, session.stackContext);
  adapter.buildInitialMessages(SYSTEM_PROMPT, userPrompt);

  const startTime = Date.now();
  let iteration = 0;
  let execCount = 0;

  while (iteration < MAX_ITERATIONS) {
    // Check timeout
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      pushEvent(session, 'step', { type: 'warning', content: 'Investigation timeout (60s). Producing diagnosis with available data.' });
      break;
    }

    iteration++;
    pushEvent(session, 'step', { type: 'thinking', content: `Iteration ${iteration}/${MAX_ITERATIONS}` });

    let response;
    try {
      response = await adapter.call();
    } catch (err) {
      pushEvent(session, 'error', { message: `LLM call failed: ${err.message}` });
      pushEvent(session, 'end', {});
      session.status = 'error';
      return;
    }

    // Stream any text content (reasoning)
    if (response.content) {
      pushEvent(session, 'step', { type: 'reasoning', content: response.content });

      // Check if this is the final diagnosis
      if (response.done && response.content.includes('DIAGNOSIS:')) {
        pushEvent(session, 'diagnosis', { raw: response.content });
        pushEvent(session, 'end', { iterations: iteration, execCalls: execCount });
        session.status = 'done';
        return;
      }
    }

    // If done with no tool calls and no diagnosis, agent decided to stop
    if (response.done) {
      pushEvent(session, 'diagnosis', { raw: response.content || 'Agent could not determine a diagnosis.' });
      pushEvent(session, 'end', { iterations: iteration, execCalls: execCount });
      session.status = 'done';
      return;
    }

    // Execute tool calls
    if (response.toolCalls.length > 0) {
      const toolResults = [];

      for (const tc of response.toolCalls) {
        // Check exec limit
        if (isExecTool(tc.name) && execCount >= MAX_EXEC_CALLS) {
          pushEvent(session, 'step', { type: 'blocked', content: `Exec limit reached (${MAX_EXEC_CALLS}). Skipping ${tc.name}.` });
          toolResults.push({
            id: tc.id,
            name: tc.name,
            content: `Error: Exec call limit reached (${MAX_EXEC_CALLS}). Use non-exec tools or produce your diagnosis.`,
          });
          continue;
        }

        pushEvent(session, 'step', {
          type: 'tool_call',
          tool: tc.name,
          arguments: tc.arguments,
        });

        const result = executeTool(tc.name, tc.arguments);
        if (isExecTool(tc.name)) execCount++;

        const resultStr = result.error
          ? `Error: ${result.error}`
          : result.result;

        pushEvent(session, 'step', {
          type: 'tool_result',
          tool: tc.name,
          preview: resultStr.slice(0, TOOL_RESULT_PREVIEW),
          length: resultStr.length,
        });

        toolResults.push({
          id: tc.id,
          name: tc.name,
          content: resultStr,
        });
      }

      adapter.appendToolResults(toolResults);
    }
  }

  // Reached max iterations without diagnosis
  pushEvent(session, 'step', { type: 'warning', content: `Max iterations (${MAX_ITERATIONS}) reached.` });
  pushEvent(session, 'diagnosis', { raw: 'DIAGNOSIS: Investigation incomplete\nROOT CAUSE: Agent reached maximum iterations without a conclusive diagnosis.\nEVIDENCE:\n- Max iterations reached\nRECOMMENDED FIX: Review the investigation steps above and check container logs manually.\nSEVERITY: medium' });
  pushEvent(session, 'end', { iterations: iteration, execCalls: execCount });
  session.status = 'done';
}

/**
 * Get agent status (configured or not).
 */
export function getAgentStatus() {
  const config = getProviderConfig();
  if (!config) {
    return { configured: false };
  }
  return {
    configured: true,
    provider: config.provider,
    model: config.model,
  };
}
