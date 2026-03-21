import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, watchConfig } from './config.js';
import { questionTool } from './tools/question.js';
import { agentqTool } from './tools/agentq.js';
import { listTool } from './tools/list.js';
import { checkTool } from './tools/check.js';
import { getDataDir } from './storage.js';

export async function startServer() {
  getDataDir();

  let config = loadConfig();

  const server = new Server(
    { name: 'askr', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  function getToolDefs() {
    const max = config?.settings?.maxConcurrent || 5;
    return [
      { name: questionTool.name, description: questionTool.getDescription(), inputSchema: questionTool.inputSchema },
      { name: agentqTool.name, description: agentqTool.getDescription(max), inputSchema: agentqTool.inputSchema },
      { name: listTool.name, description: listTool.getDescription(), inputSchema: listTool.inputSchema },
      { name: checkTool.name, description: checkTool.getDescription(), inputSchema: checkTool.inputSchema }
    ];
  }

  const toolHandlers = {
    question: questionTool.handler,
    agentq: agentqTool.handler,
    list: listTool.handler,
    check: checkTool.handler
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefs()
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];
    if (!handler) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
    return handler(config, args || {});
  });

  watchConfig((newConfig) => {
    config = newConfig;
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
