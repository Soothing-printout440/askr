import { createSession, updateSession } from '../session.js';
import { callApi } from '../api-client.js';
import { errors } from '../errors.js';

export async function executeQuestion(config, content) {
  const session = createSession(content);
  const result = await callApi(config, content, (chunk) => {
    updateSession(session.id, {
      thinking: chunk.thinking,
      answer: chunk.answer,
      streamBuffer: chunk.answer
    });
  });

  if (result.error === 'TIMEOUT') {
    updateSession(session.id, { status: 'timeout' });
    return { id: session.id, status: 'timeout', answer: null, error: errors.TIMEOUT(session.id) };
  }

  if (result.error) {
    updateSession(session.id, { status: 'error', error: result.error });
    return { id: session.id, status: 'error', answer: null, error: result.error };
  }

  if (!result.answer || result.answer.trim().length < 3) {
    updateSession(session.id, { status: 'error', error: errors.EMPTY_RESPONSE });
    return { id: session.id, status: 'error', answer: null, error: errors.EMPTY_RESPONSE };
  }

  updateSession(session.id, {
    status: 'done',
    thinking: result.thinking,
    answer: result.answer
  });

  const foldChars = config.settings.foldChars || 200;
  const folded = result.answer.length > foldChars
    ? result.answer.slice(0, foldChars) + `... [truncated, use check({id:"${session.id}", showFull:true}) for full]`
    : result.answer;

  return { id: session.id, status: 'done', answer: folded, error: null };
}

export const questionTool = {
  name: 'question',
  getDescription: () => `Ask a single question. May contain related sub-questions. Returns answer or session ID on timeout. Example: {content: 'What is REST and its core principles?'}`,
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Question to ask. Keep sub-questions closely related and simple. For unrelated questions use agentq.'
      }
    },
    required: ['content']
  },
  handler: async (config, args) => {
    if (!config) return { content: [{ type: 'text', text: errors.NOT_CONFIGURED }] };
    const result = await executeQuestion(config, args.content);
    const text = result.error || result.answer;
    return { content: [{ type: 'text', text }] };
  }
};
