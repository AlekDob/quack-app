#!/usr/bin/env node

/**
 * Visualizer MCP Server (stdio-based)
 *
 * Provides the visualize_html tool that Claude auto-discovers and invokes
 * when it wants to render interactive HTML visualizations inline in chat.
 *
 * The tool itself is a no-op on the server side — it returns confirmation text.
 * The actual rendering happens in StreamMessage.tsx which detects the tool_use
 * event and renders the HtmlVisualizer component with the input.html content.
 *
 * Brain: quack-visualizer-inline-html
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'visualize_html',
    description: `Render interactive HTML/CSS/JS visualization inline in the chat. Use this tool when you want to display:
- Charts and graphs (use Chart.js, D3.js, or pure SVG from CDN)
- Data tables with sorting/filtering
- Diagrams, flowcharts, timelines
- Interactive widgets (calculators, color pickers, etc.)
- Code review scorecards or dashboards
- Any visual representation that helps the user understand data

The HTML will be rendered in a secure sandboxed iframe. You can load external libraries from CDN (Chart.js, D3, etc.).
Always use a dark background (#1a1a2e) and light text (rgba(255,255,255,0.85)) to match the Quack theme.
Include all CSS inline. The iframe has no access to the parent page.`,
    inputSchema: {
      type: 'object',
      properties: {
        html: {
          type: 'string',
          description: 'Complete HTML content to render. Can be a full document or a fragment. Include <style> and <script> tags inline.',
        },
        title: {
          type: 'string',
          description: 'Short title for the visualization (shown in toolbar)',
        },
      },
      required: ['html'],
    },
  },
];

// =============================================================================
// TOOL HANDLER
// =============================================================================

// WHY: The tool handler is intentionally a no-op that returns confirmation.
// The rendering happens client-side in StreamMessage.tsx when it detects
// a tool_use with name 'visualize_html' and reads input.html.
function handleVisualizeHtml(args) {
  const title = args.title || 'Visualization';
  const htmlLength = (args.html || '').length;
  return `Rendered "${title}" (${htmlLength} chars of HTML). The visualization is displayed inline in the chat.`;
}

// =============================================================================
// MAIN SERVER
// =============================================================================

const server = new Server(
  { name: 'visualizer', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'visualize_html') {
    const result = handleVisualizeHtml(args);
    return { content: [{ type: 'text', text: result }] };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[VISUALIZER-MCP] Server started — visualize_html tool ready');
}

main().catch(console.error);
