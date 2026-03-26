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
    description: `Render interactive HTML/CSS visualization inline in the chat. Use this tool when you want to display:
- Charts and graphs (use pure SVG — NO JavaScript libraries)
- Data tables with sorting/filtering
- Diagrams, flowcharts, timelines
- Scorecards, dashboards, KPI cards
- Any visual representation that helps the user understand data

CRITICAL RULES:
1. NO JavaScript — the sandbox blocks script execution. Use only HTML + CSS + inline SVG.
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
