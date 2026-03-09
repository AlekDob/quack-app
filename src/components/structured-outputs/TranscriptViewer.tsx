/**
 * TranscriptViewer - Rich YouTube transcript display component
 *
 * Renders transcript data with chapters, search, and timestamp navigation.
 * Registered via ComponentRegistry for structured output rendering.
 */
import { useState, useMemo, useCallback } from 'react';
import type { StructuredOutputRendererProps } from './ComponentRegistry';
import './TranscriptViewer.css';

// ===== Types =====

export interface TranscriptEntry {
  start: number;
  text: string;
}

export interface TranscriptChapter {
  title: string;
  start_time: number;
}

export interface TranscriptOutput {
  title: string;
  channel: string;
  duration: number;
  duration_string?: string;
  language: string;
  is_auto_generated: boolean;
  chapters: TranscriptChapter[];
  transcript: TranscriptEntry[];
  available_languages?: string[];
  summary?: string;
}

// ===== Type Guard =====

export function isTranscriptOutput(data: unknown): data is TranscriptOutput {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.title === 'string' &&
    typeof obj.channel === 'string' &&
    Array.isArray(obj.transcript) &&
    obj.transcript.length > 0 &&
    typeof (obj.transcript[0] as Record<string, unknown>)?.text === 'string' &&
    typeof (obj.transcript[0] as Record<string, unknown>)?.start === 'number'
  );
}

// ===== Helpers =====

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i}>{part}</mark>
      : part
  );
}

// ===== Sub-components =====

function TranscriptHeader({ data }: { data: TranscriptOutput }) {
  const durationLabel = data.duration_string || formatDuration(data.duration);
  return (
    <div className="transcript-header">
      <div className="transcript-title-section">
        <div className="transcript-title-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <h3>{data.title}</h3>
        </div>
        <div className="transcript-channel">{data.channel}</div>
      </div>
      <div className="transcript-meta">
        <span className="transcript-badge transcript-badge--duration">{durationLabel}</span>
        <span className="transcript-badge transcript-badge--language">{data.language.toUpperCase()}</span>
        {data.is_auto_generated && (
          <span className="transcript-badge transcript-badge--auto">(auto-generated)</span>
        )}
      </div>
    </div>
  );
}

function TranscriptSummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="transcript-summary">
      <button className="transcript-summary-toggle" onClick={() => setExpanded(!expanded)}>
        <span>Summary</span>
        <svg className={expanded ? 'expanded' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && <div className="transcript-summary-content">{summary}</div>}
    </div>
  );
}

function ChaptersList({ chapters, onChapterClick }: {
  chapters: TranscriptChapter[];
  onChapterClick: (time: number) => void;
}) {
  if (chapters.length === 0) return null;
  return (
    <div className="transcript-chapters">
      <div className="transcript-chapters-label">Chapters</div>
      <div className="transcript-chapters-list">
        {chapters.map((ch, i) => (
          <button key={i} className="transcript-chapter-item" onClick={() => onChapterClick(ch.start_time)}>
            <span className="transcript-chapter-time">{formatTimestamp(ch.start_time)}</span>
            <span className="transcript-chapter-title">{ch.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== Main Component =====

export default function TranscriptViewer({ data }: StructuredOutputRendererProps<TranscriptOutput>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return data.transcript;
    const q = searchQuery.toLowerCase();
    return data.transcript.filter(e => e.text.toLowerCase().includes(q));
  }, [data.transcript, searchQuery]);

  const copyTimestamp = useCallback((seconds: number) => {
    const ts = formatTimestamp(seconds);
    navigator.clipboard.writeText(ts);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1500);
  }, []);

  const scrollToTimestamp = useCallback((time: number) => {
    const container = document.querySelector('.transcript-body');
    if (!container) return;
    // Trova la entry piu' vicina
    const entries = container.querySelectorAll('.transcript-entry');
    let closest: Element | null = null;
    let closestDiff = Infinity;
    entries.forEach((el) => {
      const ts = parseFloat(el.getAttribute('data-start') || '0');
      const diff = Math.abs(ts - time);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = el;
      }
    });
    if (closest) {
      (closest as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <div className="transcript-viewer">
      <TranscriptHeader data={data} />

      {data.summary && <TranscriptSummary summary={data.summary} />}

      <ChaptersList chapters={data.chapters} onChapterClick={scrollToTimestamp} />

      <div className="transcript-search">
        <div className="transcript-search-wrapper">
          <svg className="transcript-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="transcript-search-input"
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <span className="transcript-search-count">
              {filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="transcript-body">
        {filteredEntries.length === 0 ? (
          <div className="transcript-empty">No matching transcript entries found.</div>
        ) : (
          filteredEntries.map((entry, i) => (
            <div
              key={i}
              className={`transcript-entry ${searchQuery ? 'transcript-entry--highlight' : ''}`}
              data-start={entry.start}
            >
              <span className="transcript-timestamp" onClick={() => copyTimestamp(entry.start)} title="Click to copy timestamp">
                {formatTimestamp(entry.start)}
              </span>
              <span className="transcript-text">
                {searchQuery ? highlightText(entry.text, searchQuery) : entry.text}
              </span>
            </div>
          ))
        )}
      </div>

      {copiedToast && <div className="transcript-copied-toast">Timestamp copied!</div>}
    </div>
  );
}
