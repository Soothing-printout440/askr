import { getSession, updateSession } from '../session.js';
import { errors } from '../errors.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const checkTool = {
  name: 'check',
  getDescription: () => 'Get session result. Blocks until complete or timeout. WARNING: showFull/showThinking return large content, use in sub-agent. Example: {id: "a3f8k2", showThinking: true}',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '6-char session ID.' },
      showThinking: { type: 'boolean', description: 'Include thinking block. Default false.' },
      showFull: { type: 'boolean', description: 'Show full answer without folding. Default false.' }
    },
    required: ['id']
  },
  handler: async (config, args) => {
    if (!config) return { content: [{ type: 'text', text: errors.NOT_CONFIGURED }] };

    const { id, showThinking = false, showFull = false } = args;
    let session = getSession(id);
    if (!session) return { content: [{ type: 'text', text: errors.SESSION_NOT_FOUND(id) }] };
    if (session.status === 'closed') return { content: [{ type: 'text', text: errors.SESSION_CLOSED(id) }] };

    if (session.status === 'done' || session.status === 'error') {
      return { content: [{ type: 'text', text: formatResult(session, config, showFull, showThinking) }] };
    }

    // Blocking poll for running/timeout
    const timeout = (config.settings.timeout || 150) * 1000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      await sleep(1500);
      session = getSession(id);
      if (!session) return { content: [{ type: 'text', text: errors.SESSION_NOT_FOUND(id) }] };
      if (session.status === 'done' || session.status === 'error') {
        return { content: [{ type: 'text', text: formatResult(session, config, showFull, showThinking) }] };
      }
    }

    // Timed out waiting
    const checkCount = (session.checkCount || 0) + 1;
    updateSession(id, { checkCount });

    if (checkCount >= 2) {
      updateSession(id, { status: 'timeout' });
      return { content: [{ type: 'text', text: errors.PERMANENT_TIMEOUT(id) }] };
    }

    return { content: [{ type: 'text', text: errors.TIMEOUT(id) }] };
  }
};

function formatResult(session, config, showFull, showThinking) {
  if (session.status === 'error') {
    return `Error: ${session.error}`;
  }

  const foldChars = config.settings.foldChars || 200;
  let answer = showFull
    ? session.answer
    : (session.answer.length > foldChars
      ? session.answer.slice(0, foldChars) + `... [truncated, use check({id:"${session.id}", showFull:true}) for full]`
      : session.answer);

  let text = answer;
  if (showThinking && session.thinking) {
    text = `[Thinking]\n${session.thinking}\n\n[Answer]\n${text}`;
  }
  return text;
}
