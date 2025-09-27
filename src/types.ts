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
