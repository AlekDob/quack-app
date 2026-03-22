/**
 * AgentResultCard — Renderizza i risultati dei droid/subagent
 * come report card con markdown formattato e metadata.
 */

import { useState, useMemo } from 'react';
import { useAgentInfo } from '../hooks/useAgentInfo';
import { getDuckdroidUrl } from '../utils/agentAvatars';
import MarkdownText from './MarkdownText';
import './AgentResultCard.css';

interface AgentMetadata {
  agentId?: string;
  totalTokens?: number;
  toolUses?: number;
  durationMs?: number;
}

interface ParsedResult {
  markdown: string;
  metadata: AgentMetadata;
}

interface AgentResultCardProps {
  subagentType?: string;
  description: string;
  rawResult: any;
  workingDirectory?: string;
  defaultExpanded?: boolean;
}

/** Estrae markdown e metadata dal tool_result */
function parseAgentResult(rawResult: any): ParsedResult {
  const empty: ParsedResult = { markdown: '', metadata: {} };
  if (!rawResult) return empty;

  // Il contenuto può essere in rawResult.content o rawResult stesso
  let blocks: Array<{ text: string; type: string }> = [];

  const content = rawResult.content ?? rawResult;
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      blocks = Array.isArray(parsed) ? parsed : [];
    } catch {
      return { markdown: content, metadata: {} };
    }
  } else if (Array.isArray(content)) {
    blocks = content;
  }

  if (blocks.length === 0) {
    return { markdown: String(content), metadata: {} };
  }

  // Separa blocchi: markdown vs metadata
  let markdown = '';
  const metadata: AgentMetadata = {};

  for (const block of blocks) {
    const text = typeof block === 'string' ? block : block?.text ?? '';
    if (!text) continue;

    if (text.includes('<usage>') || text.startsWith('agentId:')) {
      parseMetadataBlock(text, metadata);
    } else {
      markdown += (markdown ? '\n\n' : '') + text;
    }
  }

  if (!markdown && blocks.length > 0) {
    const first = blocks[0];
    markdown = typeof first === 'string' ? first : first?.text ?? '';
  }

  return { markdown, metadata };
}

/** Parsa il blocco metadata con regex */
function parseMetadataBlock(text: string, out: AgentMetadata): void {
  const agentMatch = text.match(/agentId:\s*(\S+)/);
  if (agentMatch) out.agentId = agentMatch[1];

  const tokensMatch = text.match(/total_tokens:\s*(\d+)/);
  if (tokensMatch) out.totalTokens = parseInt(tokensMatch[1], 10);

  const toolsMatch = text.match(/tool_uses:\s*(\d+)/);
  if (toolsMatch) out.toolUses = parseInt(toolsMatch[1], 10);

  const durationMatch = text.match(/duration_ms:\s*(\d+)/);
  if (durationMatch) out.durationMs = parseInt(durationMatch[1], 10);
}

/** Formatta la durata in modo leggibile */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Formatta i token in modo compatto */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Converte hex in rgba */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Formatta il nome dell'agente */
function formatAgentName(id: string): string {
  return id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function AgentResultCard({
  subagentType,
  description,
  rawResult,
  workingDirectory,
  defaultExpanded = false,
}: AgentResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const agentId = subagentType || 'agent';
  const { avatarUrl, color } = useAgentInfo(agentId, workingDirectory);

  const { markdown, metadata } = useMemo(
    () => parseAgentResult(rawResult),
    [rawResult]
  );

  const displayName = formatAgentName(agentId);
  const hasPills = metadata.durationMs || metadata.totalTokens || metadata.toolUses;

  return (
    <div
      className="agent-result-card"
      style={{
        background: `linear-gradient(135deg, ${hexToRgba(color, 0.12)} 0%, ${hexToRgba(color, 0.04)} 100%)`,
        border: `1px solid ${hexToRgba(color, 0.25)}`,
      }}
    >
      <div
        className="agent-result-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <img
          src={avatarUrl || getDuckdroidUrl()}
          alt={agentId}
          className="agent-result-avatar"
        />

        <span className="agent-result-name">
          <strong style={{ color }}>{displayName}</strong>
          <span>{description}</span>
        </span>

        <span
          className="agent-result-badge"
          style={{
            color,
            background: hexToRgba(color, 0.15),
            border: `1px solid ${hexToRgba(color, 0.3)}`,
          }}
        >
          Rapporto
        </span>

        {hasPills && (
          <div className="agent-result-pills">
            {metadata.durationMs && (
              <span className="agent-result-pill">
                {formatDuration(metadata.durationMs)}
              </span>
            )}
            {metadata.totalTokens && (
              <span className="agent-result-pill">
                {formatTokens(metadata.totalTokens)} tok
              </span>
            )}
            {metadata.toolUses && (
              <span className="agent-result-pill">
                {metadata.toolUses} strumenti
              </span>
            )}
          </div>
        )}

        <span className={`agent-result-chevron ${isExpanded ? 'rotated' : ''}`}>
          &#8250;
        </span>
      </div>

      <div className={`agent-result-body ${isExpanded ? 'expanded' : ''}`}>
        {markdown && <MarkdownText>{markdown}</MarkdownText>}
      </div>
    </div>
  );
}
