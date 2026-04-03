/**
 * Feature Map Whiteboard — TypeScript interfaces
 */

/** A file referenced in a feature doc's Files table */
export interface FeatureFile {
  type: string;       // Component, Store, Service, etc.
  path: string;       // e.g. src/stores/chatStore.ts
  purpose: string;    // Brief description
}

/** A node representing a single feature doc */
export interface FeatureNode {
  id: string;         // Derived from filename (e.g. "024-integrated-code-editor")
  title: string;      // From H2 heading or frontmatter
  purpose: string;    // First line after heading
  tags: string[];     // From frontmatter
  stack: string;      // From frontmatter
  files: FeatureFile[];
  docPath: string;    // Full path to the .md file
}

/** A connection between two feature nodes sharing source files */
export interface FeatureLink {
  source: string;     // FeatureNode.id
  target: string;     // FeatureNode.id
  sharedFiles: string[]; // Paths shared between the two features
}

/** The complete feature graph */
export interface FeatureGraph {
  nodes: FeatureNode[];
  links: FeatureLink[];
}

/** Position for a node on the canvas */
export interface NodePosition {
  x: number;
  y: number;
}
