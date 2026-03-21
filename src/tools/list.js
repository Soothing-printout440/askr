import { getRecentSessions } from '../session.js';
import { errors } from '../errors.js';

export const listTool = {
  name: 'list',
  getDescription: () => 'Show recent session statuses. Example: {count: 5}',
  inputSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of recent sessions. Default 10.'
      }
    }
  },
  handler: async (config, args) => {
    if (!config) return { content: [{ type: 'text', text: errors.NOT_CONFIGURED }] };
    const sessions = getRecentSessions(args.count || 10);
    const text = sessions.length === 0
      ? 'No sessions found.'
      : JSON.stringify(sessions, null, 2);
    return { content: [{ type: 'text', text }] };
  }
};
