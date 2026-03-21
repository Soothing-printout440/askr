import { executeQuestion } from './question.js';
import { errors } from '../errors.js';

export const agentqTool = {
  name: 'agentq',
  getDescription: (maxConcurrent) => `Ask multiple independent questions in parallel. Current max: ${maxConcurrent}. Each runs in isolated context. Example: {questions: ['What is Docker?', 'What is Kubernetes?']}`,
  inputSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of independent questions. Each may have related sub-questions. Provide context per question.'
      }
    },
    required: ['questions']
  },
  handler: async (config, args) => {
    if (!config) return { content: [{ type: 'text', text: errors.NOT_CONFIGURED }] };
    const max = config.settings.maxConcurrent || 5;
    if (args.questions.length > max) {
      return { content: [{ type: 'text', text: errors.CONCURRENCY_LIMIT(max) }] };
    }
    const results = await Promise.all(args.questions.map(q => executeQuestion(config, q)));
    const text = JSON.stringify(results.map(r => ({
      id: r.id,
      status: r.status,
      ...(r.answer ? { answer: r.answer } : { error: r.error })
    })), null, 2);
    return { content: [{ type: 'text', text }] };
  }
};
