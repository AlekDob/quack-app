export type ActivityEventType =
  | 'task'
  | 'bug_fix'
  | 'decision'
  | 'deploy'
  | 'refactor'
  | 'feature'
  | 'note';

export interface ActivityEvent {
  ts: string;
  type: ActivityEventType;
  summary: string;
  actor: string;
  project: string;
  files?: string[];
  ref?: string;
}
