#!/usr/bin/env node

/**
 * Visualizer MCP Server (dual transport: stdio | http)
 *
 * Provides the visualize_html tool that Claude auto-discovers and invokes
 * when it wants to render interactive HTML visualizations inline in chat.
 *
 * The tool itself is a no-op on the server side — it returns confirmation text.
 * The actual rendering happens in StreamMessage.tsx which detects the tool_use
 * event and renders the HtmlVisualizer component with the input.html content.
 *
 * Brain: quack-visualizer-inline-html
 * Brain: ws6-mcp-http-pool
 *
 * Usage:
 *   node visualizer-mcp-server.js                  # stdio (default, retro-compat)
 *   node visualizer-mcp-server.js --http --port 0  # HTTP, OS-assigned port
 *   node visualizer-mcp-server.js --http --port 47823
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parseHttpArgs, startHttpTransport } from './lib/mcp-http-transport.js';

const SERVER_NAME = 'visualizer';
const SERVER_VERSION = '1.1.0';

const TOOLS = [
  {
    name: 'visualize_html',
    description: `Render interactive HTML/CSS/JS visualization inline in the chat. Use this tool when you want to display:
- Charts and graphs (inline SVG preferred; JS for dynamic charts is OK if bundled inline)
- Data tables with sorting/filtering
- Diagrams, flowcharts, timelines
- Scorecards, dashboards, KPI cards
- Interactive elements (tabs, accordions, counters, animations)
- Any visual representation that helps the user understand data

CRITICAL RULES:
1. JavaScript IS allowed — the iframe uses sandbox="allow-scripts". Inline <script> tags run correctly (animations, counters, tab switching, etc.). External CDN scripts are BLOCKED by CSP — bundle everything inline. No fetch, no same-origin requests.
2. Background: always use #000 (pure black). Text: rgba(255,255,255,0.85).
3. Font sizes: use 12-14px for body text, 10-11px for labels/captions, 16-20px for headings, 22-28px for KPI numbers. Never go below 10px.
4. Layout: use CSS flexbox/grid. Design for ~600px width. Use vertical stacking (single column) for complex dashboards to avoid horizontal overflow.
5. Colors: prefer the Quack palette — #FF6B35 (primary), #004E89 (secondary), #00D9FF (accent), #2ecc71 (success), #F7931E (warning).
6. Charts: build bar charts with CSS divs + percentage heights. Build donuts/pies with SVG circles + stroke-dasharray. Build gauges with CSS gradients.
7. Spacing: use compact but readable padding (8-16px). Cards with rgba(255,255,255,0.04) backgrounds and rgba(255,255,255,0.08) borders.
8. The iframe auto-resizes to content height (up to 2000px). No need to constrain height manually.

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

// WHY: the tool handler is intentionally a no-op that returns confirmation.
// The rendering happens client-side in StreamMessage.tsx when it detects
// a tool_use with name 'visualize_html' and reads input.html.
function handleVisualizeHtml(args) {
  const title = args.title || 'Visualization';
  const htmlLength = (args.html || '').length;
  return `Rendered "${title}" (${htmlLength} chars of HTML). The visualization is displayed inline in the chat.`;
}

function createMcpServer() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === 'visualize_html') {
      return { content: [{ type: 'text', text: handleVisualizeHtml(args) }] };
    }
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  return server;
}

async function main() {
  const { useHttp, port } = parseHttpArgs(process.argv);

  if (useHttp) {
    if (Number.isNaN(port) || port < 0 || port > 65535) {
      console.error('[VISUALIZER-MCP] invalid --port value, must be 0-65535');
      process.exit(2);
    }
    // Brain: ws6-mcp-http-pool — factory for per-session Server instances
    await startHttpTransport({
      serverFactory: createMcpServer,
      port,
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[VISUALIZER-MCP] stdio transport ready — visualize_html tool exposed');
  }
}

main().catch((err) => {
  console.error('[VISUALIZER-MCP] fatal:', err);
  process.exit(1);
});
