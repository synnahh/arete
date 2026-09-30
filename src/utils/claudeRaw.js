// Custom-prompt Claude request through the authenticated server gateway.
import { rateLimitClaude } from './rateLimit.js';
import { invokeAI } from '../ai/server.js';

export async function askClaudeRaw(userMessage, systemPrompt, history = [], options = {}) {
  rateLimitClaude();
  const data = await invokeAI({
    mode: 'raw',
    message: userMessage,
    systemPrompt,
    history,
    maxTokens: options.maxTokens,
    ...(options.image ? { image: options.image } : {}),
  });
  return data?.text ?? '';
}
