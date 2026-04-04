/**
 * codeIntelService
 *
 * Frontend service for code intelligence via Tauri commands.
 * Wraps code_intel_outline, code_intel_find_definition, code_intel_find_references.
 *
 * @module codeIntelService
 */

import { invoke } from '@tauri-apps/api/core';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface OutlineSymbol {
  name: string;
  kind: string;
  line: number;
  endLine: number;
  exported: boolean;
  children: OutlineSymbol[];
}

export interface SymbolDefinition {
  file: string;
  line: number;
  column: number;
  kind: string;
  exported: boolean;
  preview: string;
}

export interface FindDefinitionResult {
  symbol: string;
  definitions: SymbolDefinition[];
}

export interface SymbolReference {
  file: string;
  line: number;
  column: number;
  context: string;
  preview: string;
}

export interface FindReferencesResult {
  symbol: string;
  totalCount: number;
  references: SymbolReference[];
}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------

/** Get AST outline for a file */
export async function getOutline(
  filePath: string
): Promise<OutlineSymbol[]> {
  return invoke<OutlineSymbol[]>('code_intel_outline', {
    filePath,
  });
}

/** Find where a symbol is defined */
export async function findDefinition(
  symbol: string,
  projectPath: string
): Promise<FindDefinitionResult> {
  return invoke<FindDefinitionResult>('code_intel_find_definition', {
    symbol,
    projectPath,
  });
}

/** Find all references to a symbol */
export async function findReferences(
  symbol: string,
  projectPath: string,
  maxResults?: number
): Promise<FindReferencesResult> {
  return invoke<FindReferencesResult>('code_intel_find_references', {
    symbol,
    projectPath,
    maxResults,
  });
}
