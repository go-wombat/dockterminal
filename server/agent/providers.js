// LLM provider abstraction — OpenAI and Anthropic adapters.
// Each adapter stores messages in provider-native format (no lossy round-trip).
// Normalized return: { content, toolCalls: [{id, name, arguments}], done }

import { TOOL_SCHEMAS } from './tools.js';

// --- OpenAI adapter ---

function openaiToolSchemas() {
  return TOOL_SCHEMAS.map(t => ({
    type: 'function',
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    strict: false,
  }));
}

class OpenAIAdapter {
  constructor(apiKey, model) {
    this.model = model || 'gpt-5.2-codex';
    this.apiKey = apiKey;
    this.client = null;
    this.instructions = '';
    this.input = [];
    this.tools = openaiToolSchemas();
  }

  async init() {
    const { default: OpenAI } = await import('openai');
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  buildInitialMessages(systemPrompt, userPrompt) {
    this.instructions = systemPrompt;
    this.input = [
      { role: 'user', content: userPrompt, type: 'message' },
    ];
  }

  async call() {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.instructions,
      input: this.input,
      tools: this.tools,
      tool_choice: 'auto',
    });

    // Append all output items to input for conversation continuity
    for (const item of response.output) {
      this.input.push(item);
    }

    let textContent = '';
    const toolCalls = [];

    for (const item of response.output) {
      if (item.type === 'message') {
        for (const part of item.content) {
          if (part.type === 'output_text') {
            textContent += part.text;
          }
        }
      } else if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id,
          name: item.name,
          arguments: JSON.parse(item.arguments || '{}'),
        });
      }
    }

    return {
      content: textContent || null,
      toolCalls,
      done: response.status === 'completed' && toolCalls.length === 0,
    };
  }

  appendToolResults(results) {
    for (const r of results) {
      this.input.push({
        type: 'function_call_output',
        call_id: r.id,
        output: r.content,
      });
    }
  }
}

// --- Anthropic adapter ---

function anthropicToolSchemas() {
  return TOOL_SCHEMAS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

class AnthropicAdapter {
  constructor(apiKey, model) {
    this.model = model || 'claude-sonnet-4-5-20250929';
    this.apiKey = apiKey;
    this.client = null;
    this.systemPrompt = '';
    this.messages = [];
    this.tools = anthropicToolSchemas();
  }

  async init() {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  buildInitialMessages(systemPrompt, userPrompt) {
    this.systemPrompt = systemPrompt;
    this.messages = [
      { role: 'user', content: userPrompt },
    ];
  }

  async call() {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemPrompt,
      messages: this.messages,
      tools: this.tools,
    });

    // Store full response content blocks as assistant message
    this.messages.push({ role: 'assistant', content: response.content });

    let textContent = '';
    const toolCalls = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    return {
      content: textContent || null,
      toolCalls,
      done: response.stop_reason === 'end_turn' && toolCalls.length === 0,
    };
  }

  appendToolResults(results) {
    // Anthropic requires tool results in a single user message with tool_result blocks
    const blocks = results.map(r => ({
      type: 'tool_result',
      tool_use_id: r.id,
      content: r.content,
    }));
    this.messages.push({ role: 'user', content: blocks });
  }
}

// --- Factory ---

/**
 * Detect configured provider and return { provider, model, adapter }.
 * Returns null if no API key is set.
 */
export function getProviderConfig() {
  const explicit = process.env.DOCKTERMINAL_LLM_PROVIDER?.toLowerCase();
  const modelOverride = process.env.DOCKTERMINAL_LLM_MODEL;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (explicit === 'openai' && openaiKey) {
    return { provider: 'openai', model: modelOverride || 'gpt-5.2-codex', apiKey: openaiKey };
  }
  if (explicit === 'anthropic' && anthropicKey) {
    return { provider: 'anthropic', model: modelOverride || 'claude-sonnet-4-5-20250929', apiKey: anthropicKey };
  }

  // Auto-detect from available keys (prefer explicit, then anthropic, then openai)
  if (anthropicKey) {
    return { provider: 'anthropic', model: modelOverride || 'claude-sonnet-4-5-20250929', apiKey: anthropicKey };
  }
  if (openaiKey) {
    return { provider: 'openai', model: modelOverride || 'gpt-5.2-codex', apiKey: openaiKey };
  }

  return null;
}

/**
 * Create a provider adapter instance.
 */
export async function createAdapter(config) {
  let adapter;
  if (config.provider === 'openai') {
    adapter = new OpenAIAdapter(config.apiKey, config.model);
  } else {
    adapter = new AnthropicAdapter(config.apiKey, config.model);
  }
  await adapter.init();
  return adapter;
}
