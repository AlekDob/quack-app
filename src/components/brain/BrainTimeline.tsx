import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  Bug,
  Lightbulb,
  Rocket,
  Code,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronRight,
  Puzzle,
  AlertTriangle,
  Search,
  BookOpen,
} from 'lucide-react';
import { readActivities } from '../../services/activityLogService';
import { listBrainEntries, readBrainEntry } from '../../services/brainFileService';
import type { ActivityEvent, ActivityEventType } from '../../types/activity';

interface BrainTimelineProps {
  projectPath?: string;
  isGlobal?: boolean;
  onSelectEntry?: (filePath: string) => void;
}

const typeIcons: Record<ActivityEventType, React.ReactNode> = {
  task: <CheckCircle size={16} />,
  bug_fix: <Bug size={16} />,
  decision: <Lightbulb size={16} />,
  deploy: <Rocket size={16} />,
  refactor: <Code size={16} />,
  feature: <Sparkles size={16} />,
  pattern: <Puzzle size={16} />,
  gotcha: <AlertTriangle size={16} />,
  diary: <BookOpen size={16} />,
  note: <FileText size={16} />,
};

const typeLabels: Record<ActivityEventType, string> = {
  task: 'Task',
  bug_fix: 'Bug Fix',
  decision: 'Decision',
  deploy: 'Deploy',
  refactor: 'Refactor',
  feature: 'Feature',
  pattern: 'Pattern',
  gotcha: 'Gotcha',
  diary: 'Diary',
  note: 'Note',
};

export default function BrainTimeline({ projectPath, isGlobal, onSelectEntry }: BrainTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<ActivityEventType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [contentIndex, setContentIndex] = useState<Map<string, string>>(new Map());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedContent, setExpandedContent] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    loadActivities();
  }, [projectPath, isGlobal]);

  const loadActivities = async () => {
    if (!isGlobal && !projectPath) return;
    const index = new Map<string, string>();
    // Load JSONL activity events (project only)
    const jsonlEvents = !isGlobal && projectPath
      ? await readActivities(projectPath)
      : [];
    // Load diary entries as timeline events
    const diaryEvents = await loadDiaryAsEvents(index);
    // Load brain knowledge entries as timeline events
    const brainEvents = await loadBrainAsEvents(index);
    // Merge and sort by date (most recent first)
    const all = [...jsonlEvents, ...diaryEvents, ...brainEvents]
      .sort((a, b) => {
        const dateA = a.ts.split('T')[0];
        const dateB = b.ts.split('T')[0];
        return dateB.localeCompare(dateA);
      });
    setContentIndex(index);
    setEvents(all);
  };

  const loadDiaryAsEvents = async (index: Map<string, string>): Promise<ActivityEvent[]> => {
    const diaryFiles = await listBrainEntries(
      isGlobal
        ? { global: true, type: 'diary' }
        : { projectRoot: projectPath, type: 'diary' }
    );
    const events: ActivityEvent[] = [];
    for (const filePath of diaryFiles) {
      const entry = await readBrainEntry(filePath);
      if (!entry) continue;
      index.set(filePath, entry.content.toLowerCase());
      const date = entry.created || filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
      // Parse bullet points from diary content (reverse: last added = most recent)
      // Supports: `- [HH:MM] (Author) text` and plain `- text`
      const lines = entry.content.split('\n').reverse();
      for (const line of lines) {
        const bullet = line.match(/^[-*]\s+(.+)/);
        if (!bullet) continue;
        const raw = bullet[1].trim();
        const rich = raw.match(/^\[(\d{2}:\d{2})\]\s*(?:\(([^)]+)\)\s*)?(.+)/);
        const time = rich ? rich[1] : '';
        const author = rich ? (rich[2] || '') : '';
        const summary = rich ? rich[3].trim() : raw;
        const ts = time ? `${date}T${time}:00` : date;
        events.push({
          ts,
          type: 'diary',
          summary,
          actor: author || 'diary',
          project: 'quack-app',
          ref: filePath,
        });
      }
    }
    return events;
  };

  const loadBrainAsEvents = async (index: Map<string, string>): Promise<ActivityEvent[]> => {
    const brainTypes = ['bug_fix', 'decision', 'pattern', 'gotcha'] as const;
    const events: ActivityEvent[] = [];
    for (const brainType of brainTypes) {
      const files = await listBrainEntries(
        isGlobal
          ? { global: true, type: brainType }
          : { projectRoot: projectPath, type: brainType }
      );
      for (const filePath of files) {
        const entry = await readBrainEntry(filePath);
        if (!entry) continue;
        index.set(filePath, (entry.title + ' ' + entry.content).toLowerCase());
        const eventType = brainType === 'bug_fix' || entry.type === 'bug'
          ? 'bug_fix' : brainType as ActivityEventType;
        const date = entry.created
          || filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1]
          || '';
        if (!date) continue;
        events.push({
          ts: date,
          type: eventType,
          summary: entry.title,
          actor: 'brain',
          project: entry.project || projectPath?.split('/').pop() || '',
          ref: filePath,
        });
      }
    }
    return events;
  };

  const toggleExpand = async (index: number, event: ActivityEvent) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
      if (event.ref && !expandedContent.has(index)) {
        const entry = await readBrainEntry(event.ref);
        if (entry) {
          setExpandedContent(new Map(expandedContent.set(index, entry.content)));
        }
      }
    }
    setExpanded(newExpanded);
  };

  const groupByDate = (events: ActivityEvent[]) => {
    const groups: Record<string, ActivityEvent[]> = {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    events.forEach(event => {
      const eventDate = event.ts.split('T')[0];
      let label: string;

      if (eventDate === today) {
        label = 'Today';
      } else if (eventDate === yesterday) {
        label = 'Yesterday';
      } else if (new Date(eventDate) >= weekAgo) {
        label = 'This week';
      } else {
        const d = new Date(eventDate + 'T00:00:00');
        label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(event);
    });

    return groups;
  };

  const activeTypes = new Set(events.map(e => e.type));
  const filteredEvents = useMemo(() => {
    let result = filter === 'all' ? events : events.filter(e => e.type === filter);
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter(e => {
        if (e.summary.toLowerCase().includes(query)) return true;
        if (e.ref && contentIndex.has(e.ref)) {
          return contentIndex.get(e.ref)!.includes(query);
        }
        return false;
      });
    }
    return result;
  }, [events, filter, search, contentIndex]);
  const grouped = groupByDate(filteredEvents);

  const formatTime = (ts: string) => {
    // Diary entries have date-only (YYYY-MM-DD), no fake time to show
    if (!ts.includes('T')) return '';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="brain-timeline">
      <div className="brain-timeline-header">
        <h2>Timeline</h2>
        <div className="brain-timeline-controls">
          <div className="brain-timeline-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Cerca nei contenuti..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="brain-timeline-filters">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {Object.keys(typeIcons)
              .filter(type => activeTypes.has(type as ActivityEventType))
              .map(type => (
              <button
                key={type}
                className={filter === type ? 'active' : ''}
                onClick={() => setFilter(type as ActivityEventType)}
                title={typeLabels[type as ActivityEventType]}
              >
                {typeIcons[type as ActivityEventType]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="brain-empty-state">
          <FileText size={48} />
          <p>No activity recorded</p>
        </div>
      ) : (
        <div className="brain-timeline-content">
          {Object.entries(grouped).map(([dateLabel, dateEvents]) => (
            <div key={dateLabel} className="brain-timeline-group">
              <div className="brain-timeline-date">{dateLabel}</div>
              {dateEvents.map((event, idx) => {
                const globalIdx = events.indexOf(event);
                const isExpanded = expanded.has(globalIdx);
                return (
                  <div key={globalIdx} className="brain-event-card">
                    <div
                      className="brain-event-header"
                      onClick={() => {
                        if (!event.ref) return;
                        if (onSelectEntry) {
                          onSelectEntry(event.ref);
                        } else {
                          toggleExpand(globalIdx, event);
                        }
                      }}
                      style={{ cursor: event.ref ? 'pointer' : 'default' }}
                    >
                      <div className={`brain-event-icon brain-event-icon-${event.type}`}>
                        {typeIcons[event.type]}
                      </div>
                      <div className="brain-event-details">
                        <div className="brain-event-summary">{event.summary}</div>
                        <div className="brain-event-meta">
                          {formatTime(event.ts) && (
                            <span className="brain-event-time">{formatTime(event.ts)}</span>
                          )}
                          <span className="brain-event-actor">{event.actor}</span>
                        </div>
                      </div>
                      {event.ref && (
                        <div className="brain-event-expand">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      )}
                    </div>
                    {isExpanded && expandedContent.has(globalIdx) && (
                      <div className="brain-event-content">
                        <pre>{expandedContent.get(globalIdx)}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
