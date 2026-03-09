/**
 * Quack Component Catalog for json-render
 *
 * Defines which UI components the AI can generate via Generative UI.
 * Each component has typed props (Zod) and a description for AI guidance.
 */
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const quackCatalog = defineCatalog(schema, {
  components: {
    // Layout components
    Card: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable().optional(),
        variant: z.enum(['default', 'outlined', 'elevated']).optional(),
      }),
      description: 'Container card with optional title and subtitle. Use as a wrapper for grouped content.',
    },
    Section: {
      props: z.object({
        title: z.string(),
        collapsible: z.boolean().optional(),
        defaultExpanded: z.boolean().optional(),
      }),
      description: 'Collapsible section with a header. Use to organize long content into expandable blocks.',
    },
    Columns: {
      props: z.object({
        columns: z.number().min(2).max(4).optional(),
        gap: z.enum(['sm', 'md', 'lg']).optional(),
      }),
      description: 'Multi-column layout. Children are distributed evenly across columns.',
    },

    // Content components
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(['h1', 'h2', 'h3', 'h4']).optional(),
      }),
      description: 'Text heading. Use for titles and section headers.',
    },
    Text: {
      props: z.object({
        content: z.string(),
        variant: z.enum(['body', 'caption', 'code']).optional(),
      }),
      description: 'Text block. Supports body, caption, and code variants.',
    },
    Badge: {
      props: z.object({
        label: z.string(),
        color: z.enum(['default', 'success', 'warning', 'error', 'info']).optional(),
      }),
      description: 'Small label badge for status indicators or tags.',
    },
    CodeBlock: {
      props: z.object({
        code: z.string(),
        language: z.string().optional(),
        title: z.string().optional(),
      }),
      description: 'Syntax-highlighted code block with optional language and title.',
    },
    Image: {
      props: z.object({
        src: z.string(),
        alt: z.string(),
        caption: z.string().optional(),
      }),
      description: 'Image with alt text and optional caption.',
    },

    // Data display
    Table: {
      props: z.object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        caption: z.string().optional(),
      }),
      description: 'Data table with headers and rows. Use for structured tabular data.',
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().optional(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
      }),
      description: 'Single metric display with value, label, and optional trend indicator.',
    },
    ProgressBar: {
      props: z.object({
        value: z.number().min(0).max(100),
        label: z.string().optional(),
        color: z.enum(['default', 'success', 'warning', 'error']).optional(),
      }),
      description: 'Horizontal progress bar with percentage value.',
    },
    List: {
      props: z.object({
        items: z.array(z.string()),
        ordered: z.boolean().optional(),
        icon: z.string().optional(),
      }),
      description: 'Ordered or unordered list of text items.',
    },
    KeyValue: {
      props: z.object({
        pairs: z.array(z.object({
          key: z.string(),
          value: z.string(),
        })),
      }),
      description: 'Key-value pairs displayed as a definition list. Use for metadata or properties.',
    },

    // Interactive components
    Link: {
      props: z.object({
        href: z.string(),
        label: z.string(),
        external: z.boolean().optional(),
      }),
      description: 'Clickable link. Set external=true to open in new tab.',
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary', 'ghost']).optional(),
        action: z.string(),
      }),
      description: 'Clickable button that emits an action when pressed.',
    },
    Tabs: {
      props: z.object({
        tabs: z.array(z.object({
          label: z.string(),
          id: z.string(),
        })),
        defaultTab: z.string().optional(),
      }),
      description: 'Tab navigation. Each tab\'s content should be a child element keyed by tab id.',
    },

    // Alert/Status
    Alert: {
      props: z.object({
        message: z.string(),
        type: z.enum(['info', 'success', 'warning', 'error']).optional(),
        title: z.string().optional(),
      }),
      description: 'Alert banner for important messages. Types: info, success, warning, error.',
    },
  },
  actions: {
    copy_to_clipboard: { description: 'Copy text content to clipboard' },
    open_link: { description: 'Open a URL in the default browser' },
    open_file: { description: 'Open a file path in the IDE' },
    expand_section: { description: 'Toggle expansion of a collapsible section' },
  },
});

export type QuackCatalog = typeof quackCatalog;
