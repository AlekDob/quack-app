/**
 * Structured Outputs Components
 *
 * UI components for displaying structured output data from Claude Agent SDK.
 * New output types are registered in the ComponentRegistry.
 */

// Component exports
export { default as BugReportWidget } from './BugReportWidget';
export { default as WebAnalysisCard } from './WebAnalysisCard';
export { default as TranscriptViewer } from './TranscriptViewer';
export { default as JsonRenderAdapter } from './JsonRenderAdapter';

// Registry & Catalog exports
export { structuredOutputRegistry } from './ComponentRegistry';
export type { StructuredOutputRendererProps, StructuredOutputAction } from './ComponentRegistry';
export { quackCatalog } from './quackCatalog';
export { quackRegistry } from './quackRegistry';

// Register all renderers in the registry
import { structuredOutputRegistry } from './ComponentRegistry';
import BugReportWidget from './BugReportWidget';
import WebAnalysisCard from './WebAnalysisCard';
import TranscriptViewer from './TranscriptViewer';
import JsonRenderAdapter from './JsonRenderAdapter';
import { isBugReportOutput, isWebAnalysisOutput } from '../../types/structuredOutputs';
import { isTranscriptOutput } from './TranscriptViewer';
import { isJsonRenderSpec } from './JsonRenderAdapter';

structuredOutputRegistry.register({
  typeGuard: isBugReportOutput,
  component: BugReportWidget as never,
  priority: 10,
});
structuredOutputRegistry.register({
  typeGuard: isWebAnalysisOutput,
  component: WebAnalysisCard as never,
  priority: 10,
});
structuredOutputRegistry.register({
  typeGuard: isTranscriptOutput,
  component: TranscriptViewer as never,
  priority: 10,
});
// json-render: lowest priority — catches any spec with { root, elements } structure
structuredOutputRegistry.register({
  typeGuard: isJsonRenderSpec,
  component: JsonRenderAdapter as never,
  priority: 1,
});
