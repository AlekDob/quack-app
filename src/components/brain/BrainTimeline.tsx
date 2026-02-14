import React, { useState, useEffect } from 'react';
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
  BookOpen,
} from 'lucide-react';
import { readActivities } from '../../services/activityLogService';
import { listBrainEntries, readBrainEntry } from '../../services/brainFileService';
import type { ActivityEvent, ActivityEventType } from '../../types/activity';

interface BrainTimelineProps {
  projectPath?: string;
  isGlobal?: boolean;
}

const typeIcons: Record<ActivityEventType, React.ReactNode> = {
  task: <CheckCircle size={16} />,
  bug_fix: <Bug size={16} />,
  decision: <Lightbulb size={16} />,
  deploy: <Rocket size={16} />,
  refactor: <Code size={16} />,
  feature: <Sparkles size={16} />,
  note: <FileText size={16} />,
};

export default function BrainTimeline({ projectPath, isGlobal }: BrainTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<ActivityEventType | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedContent, setExpandedContent] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    loadActivities();
  }, [projectPath, isGlobal]);

  const loadActivities = async () => {
    if (!isGlobal && !projectPath) return;
    // Load JSONL activity events (project only)
    const jsonlEvents = !isGlobal && projectPath
      ? await readActivities(projectPath)
      : [];
    // Load diary entries as timeline events
    const diaryEvents = await loadDiaryAsEvents();
    // Merge and sort by date (most recent first)
    const all = [...jsonlEvents, ...diaryEvents]
      .sort((a, b) => {
        const dateA = a.ts.split('T')[0];
        const dateB = b.ts.split('T')[0];
        return dateB.localeCompare(dateA);
      });
    setEvents(all);
  };

  const loadDiaryAsEvents = async (): Promise<ActivityEvent[]> => {
    const diaryFiles = await listBrainEntries(
      isGlobal
        ? { global: true, type: 'diary' }
        : { projectRoot: projectPath, type: 'diary' }
    );
    const events: ActivityEvent[] = [];
    for (const filePath of diaryFiles) {
      const entry = await readBrainEntry(filePath);
      if (!entry) continue;
      const date = entry.created || filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
      // Parse bullet points from diary content
      const lines = entry.content.split('\n');
      for (const line of lines) {
        const bullet = line.match(/^[-*]\s+(.+)/);
        if (bullet) {
          events.push({
            ts: date, // date-only string, no fake time
            type: 'note',
            summary: bullet[1].trim(),
            actor: 'diary',
            project: 'quack-app',
            ref: filePath,
          });
        }
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

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);
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
        <div className="brain-timeline-filters">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {Object.keys(typeIcons).map(type => (
            <button
              key={type}
              className={filter === type ? 'active' : ''}
              onClick={() => setFilter(type as ActivityEventType)}
            >
              {typeIcons[type as ActivityEventType]}
            </button>
          ))}
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
                      onClick={() => event.ref && toggleExpand(globalIdx, event)}
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
