# MCP and Custom Tools

## MCP in the SDK

Model Context Protocol (MCP) servers extend Claude Code with custom tools and capabilities. MCPs can run as external processes, connect via HTTP/SSE, or execute directly within your SDK application.

### Basic Configuration

Configure MCP servers in `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/Users/me/projects"
      }
    }
  }
}
```

### Using MCP Servers in SDK

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "List files in my project",
  options: {
    mcpServers: {
      "filesystem": {
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem"],
        env: {
          ALLOWED_PATHS: "/Users/me/projects"
        }
      }
    },
    allowedTools: ["mcp__filesystem__list_files"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

## Transport Types

### stdio Servers

External processes communicating via stdin/stdout:

```json
{
  "mcpServers": {
    "my-tool": {
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "env": {
        "DEBUG": "${DEBUG:-false}"
      }
    }
  }
}
```

### HTTP/SSE Servers

Remote servers with network communication:

```json
// SSE server
{
  "mcpServers": {
    "remote-api": {
      "type": "sse",
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}

// HTTP server
{
  "mcpServers": {
    "http-service": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "X-API-Key": "${API_KEY}"
      }
    }
  }
}
```

### SDK MCP Servers

In-process servers running within your application. See Custom Tools section below for details.

## Resource Management

MCP servers can expose resources that Claude can list and read:

```typescript
for await (const message of query({
  prompt: "What resources are available from the database server?",
  options: {
    mcpServers: {
      "database": {
        command: "npx",
        args: ["@modelcontextprotocol/server-database"]
      }
    },
    allowedTools: ["mcp__list_resources", "mcp__read_resource"]
  }
})) {
  if (message.type === "result") console.log(message.result);
}
```

## Authentication

### Environment Variables

```json
{
  "mcpServers": {
    "secure-api": {
      "type": "sse",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}",
        "X-API-Key": "${API_KEY:-default-key}"
      }
    }
  }
}
```

### OAuth2 Authentication

OAuth2 MCP authentication in-client is not currently supported.

## Error Handling

Handle MCP connection failures gracefully:

```typescript
for await (const message of query({
  prompt: "Process data",
  options: {
    mcpServers: {
      "data-processor": dataServer
    }
  }
})) {
  if (message.type === "system" && message.subtype === "init") {
    const failedServers = message.mcp_servers.filter(
      s => s.status !== "connected"
    );

    if (failedServers.length > 0) {
      console.warn("Failed to connect:", failedServers);
    }
  }

  if (message.type === "result" && message.subtype === "error_during_execution") {
    console.error("Execution failed");
  }
}
```

---

## Custom Tools

Custom tools allow you to extend Claude Code's capabilities with your own functionality through in-process MCP servers.

### Creating Custom Tools

Use the `createSdkMcpServer` and `tool` helper functions:

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const customServer = createSdkMcpServer({
  name: "my-custom-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",
      "Get current weather for a location",
      {
        location: z.string().describe("City name or coordinates"),
        units: z.enum(["celsius", "fahrenheit"]).default("celsius")
      },
      async (args) => {
        const response = await fetch(
          `https://api.weather.com/v1/current?q=${args.location}&units=${args.units}`
        );
        const data = await response.json();

        return {
          content: [{
            type: "text",
            text: `Temperature: ${data.temp}°\nConditions: ${data.conditions}`
          }]
        };
      }
    )
  ]
});
```

### Using Custom Tools

**Important**: Custom MCP tools require streaming input mode. You must use an async generator/iterable for the `prompt` parameter.

```typescript
// Use async generator for streaming input
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "What's the weather in San Francisco?"
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),  // Use async generator
  options: {
    mcpServers: {
      "my-custom-tools": customServer  // Pass as object
    },
    allowedTools: [
      "mcp__my-custom-tools__get_weather"
    ]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

### Tool Name Format

MCP tool names follow a specific pattern:
- Pattern: `mcp__{server_name}__{tool_name}`
- Example: `get_weather` in server `my-custom-tools` becomes `mcp__my-custom-tools__get_weather`

### Multiple Tools Example

```typescript
const multiToolServer = createSdkMcpServer({
  name: "utilities",
  version: "1.0.0",
  tools: [
    tool("calculate", "Perform calculations", { /* ... */ }, async (args) => { /* ... */ }),
    tool("translate", "Translate text", { /* ... */ }, async (args) => { /* ... */ }),
    tool("search_web", "Search the web", { /* ... */ }, async (args) => { /* ... */ })
  ]
});

// Allow only specific tools
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "Calculate 5 + 3 and translate 'hello' to Spanish"
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),
  options: {
    mcpServers: {
      utilities: multiToolServer
    },
    allowedTools: [
      "mcp__utilities__calculate",
      "mcp__utilities__translate"
      // "mcp__utilities__search_web" is NOT allowed
    ]
  }
})) {
  // Process messages
}
```

### Type Safety with Zod

```typescript
tool(
  "process_data",
  "Process structured data with type safety",
  {
    data: z.object({
      name: z.string(),
      age: z.number().min(0).max(150),
      email: z.string().email(),
      preferences: z.array(z.string()).optional()
    }),
    format: z.enum(["json", "csv", "xml"]).default("json")
  },
  async (args) => {
    // args is fully typed based on the schema
    console.log(`Processing ${args.data.name}'s data as ${args.format}`);

    return {
      content: [{
        type: "text",
        text: `Processed data for ${args.data.name}`
      }]
    };
  }
)
```

### Error Handling

```typescript
tool(
  "fetch_data",
  "Fetch data from an API",
  {
    endpoint: z.string().url().describe("API endpoint URL")
  },
  async (args) => {
    try {
      const response = await fetch(args.endpoint);

      if (!response.ok) {
        return {
          content: [{
            type: "text",
            text: `API error: ${response.status} ${response.statusText}`
          }]
        };
      }

      const data = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to fetch data: ${error.message}`
        }]
      };
    }
  }
)
```

## Example Tools

### Database Query Tool

```typescript
const databaseServer = createSdkMcpServer({
  name: "database-tools",
  version: "1.0.0",
  tools: [
    tool(
      "query_database",
      "Execute a database query",
      {
        query: z.string().describe("SQL query to execute"),
        params: z.array(z.any()).optional().describe("Query parameters")
      },
      async (args) => {
        const results = await db.query(args.query, args.params || []);
        return {
          content: [{
            type: "text",
            text: `Found ${results.length} rows:\n${JSON.stringify(results, null, 2)}`
          }]
        };
      }
    )
  ]
});
```

### API Gateway Tool

```typescript
const apiGatewayServer = createSdkMcpServer({
  name: "api-gateway",
  version: "1.0.0",
  tools: [
    tool(
      "api_request",
      "Make authenticated API requests to external services",
      {
        service: z.enum(["stripe", "github", "openai", "slack"]),
        endpoint: z.string().describe("API endpoint path"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]),
        body: z.record(z.any()).optional()
      },
      async (args) => {
        const config = {
          stripe: { baseUrl: "https://api.stripe.com/v1", key: process.env.STRIPE_KEY },
          github: { baseUrl: "https://api.github.com", key: process.env.GITHUB_TOKEN }
        };

        const { baseUrl, key } = config[args.service];
        const url = `${baseUrl}${args.endpoint}`;

        const response = await fetch(url, {
          method: args.method,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: args.body ? JSON.stringify(args.body) : undefined
        });

        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      }
    )
  ]
});
```
