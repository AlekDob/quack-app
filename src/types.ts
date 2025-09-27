export interface TerminalInfo {
  id: string
  label: string
  color: string
  cwd: string
  alive: boolean
  status?: 'idle' | 'busy'
  needsAttention?: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  is_dir: boolean
  is_symlink: boolean
}

export interface DirectoryListing {
  path: string
  entries: DirectoryEntry[]
}

export interface GitStatusEntry {
  path: string
  original_path: string | null
  staged_status: string | null
  unstaged_status: string | null
  is_untracked: boolean
}

export interface GitStatusSummary {
  branch: string
  upstream: string | null
  ahead: number | null
  behind: number | null
  entries: GitStatusEntry[]
  clean: boolean
}

export interface GitCommitEntry {
  hash: string
  summary: string
  author: string
  relativeTime: string
}

export interface TerminalDataEvent {
  id: string
  data: string
}

export interface TerminalExitEvent {
  id: string
  code: number
  success: boolean
  message: string | null
}
