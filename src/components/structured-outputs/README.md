# Structured Outputs Components

UI components for displaying structured output data from Claude Agent SDK.

## 📦 Available Components

### BugReportWidget

Displays bug analysis reports with severity levels, file locations, and suggested fixes.

```typescript
import { BugReportWidget } from './components/structured-outputs';
import type { BugReportOutput } from './types/structuredOutputs';

const bugData: BugReportOutput = {
  bugs_found: [
    {
      severity: 'high',
      file: 'src/utils/parser.ts',
      line: 42,
      description: 'Potential null pointer dereference',
      suggested_fix: 'Add null check before accessing property',
      category: 'Runtime Error',
      impact: 'Application crash on invalid input'
    }
  ],
  total_issues: 1,
  summary: 'Found 1 high severity issue',
  risk_score: 7.5
};

<BugReportWidget
  data={bugData}
  onFileClick={(path, line) => console.log(`Open ${path}:${line}`)}
/>
```

**Features:**
- Color-coded severity badges (critical, high, medium, low)
- Expandable bug details
- File location with line numbers
- Suggested fixes highlighted
- Risk score visualization
- Click to open files

### WebAnalysisCard

Displays web content analysis with key points, links, and metadata.

```typescript
import { WebAnalysisCard } from './components/structured-outputs';
import type { WebAnalysisOutput } from './types/structuredOutputs';

const webData: WebAnalysisOutput = {
  title: 'Claude Agent SDK - Structured Outputs',
  summary: 'Documentation for using structured outputs with Claude Agent SDK...',
  key_points: [
    'Define JSON schemas for validated outputs',
    'TypeScript types for type safety',
    'Automatic validation and error handling'
  ],
  links: [
    {
      url: 'https://platform.claude.com/docs',
      description: 'Official Claude Documentation'
    }
  ],
  confidence_score: 0.95,
  metadata: {
    word_count: 2500,
    reading_time_minutes: 10,
    last_updated: '2025-01-22T10:00:00Z'
  }
};

<WebAnalysisCard
  data={webData}
  onLinkClick={(url) => window.open(url)}
/>
```

**Features:**
- Confidence score indicator
- Collapsible key points list
- Related links with descriptions
- Metadata badges (word count, reading time, last updated)
- "Show More" buttons for long lists

## 🎨 Styling

All components include their own CSS files and use CSS variables for theming:

- `--color-text`: Main text color
- `--color-text-secondary`: Secondary text color

Components use consistent glassmorphism design with:
- Gradient backgrounds
- Border effects
- Hover animations
- Smooth transitions

## 🔧 TypeScript Types

All types are defined in `src/types/structuredOutputs.ts`:

```typescript
import type {
  BugReportOutput,
  WebAnalysisOutput,
  FileAnalysisOutput,
  JSONSchema,
  OutputFormat
} from './types/structuredOutputs';
```

## ✅ Type Validators

Use built-in validators to check if data matches expected schema:

```typescript
import { isBugReportOutput, isWebAnalysisOutput } from './types/structuredOutputs';

if (isBugReportOutput(data)) {
  // TypeScript knows data is BugReportOutput
  return <BugReportWidget data={data} />;
}
```

## 📝 JSON Schemas

Pre-defined schemas ready to use with Claude Agent SDK:

```typescript
import { bugReportSchema, webAnalysisSchema } from './types/structuredOutputs';

// Use in agent configuration
const outputFormat: OutputFormat = {
  type: 'json_schema',
  json_schema: bugReportSchema
};
```

## 🚀 Usage Example

Complete example with Claude Agent SDK (when backend support is added):

```typescript
import { BugReportWidget } from './components/structured-outputs';
import { bugReportSchema } from './types/structuredOutputs';
import type { BugReportOutput } from './types/structuredOutputs';

// Send message to agent with structured output
const response = await sendMessageWithStructuredOutput({
  prompt: 'Analyze this code for bugs',
  outputFormat: {
    type: 'json_schema',
    json_schema: bugReportSchema
  }
});

// Response will be validated BugReportOutput
const bugReport: BugReportOutput = response.structured_output;

// Render with widget
<BugReportWidget data={bugReport} onFileClick={openFile} />
```

## 🎯 Best Practices

1. **Always validate** structured outputs before rendering
2. **Handle errors** gracefully when parsing fails
3. **Provide fallbacks** for optional fields
4. **Use type guards** to ensure type safety
5. **Test with mock data** before integrating with real agents

## 📚 Further Reading

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
- [JSON Schema Specification](https://json-schema.org/)
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
