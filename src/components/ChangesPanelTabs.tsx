import type { GitCommitEntry } from '../types'
import './ChangesPanel.css'

export type ActiveTab = 'pending' | 'committed' | 'history' | 'branches' | 'worktrees' | 'remotes'

interface ChangesPanelTabsProps {
  activeTab: ActiveTab
  pendingCount: number
  committedCount: number
  history?: GitCommitEntry[]
  branchCount: number
  worktreeCount: number
  remoteCount: number
  onTabChange: (tab: ActiveTab) => void
}

function TabButton({ id, label, active, count, countClass, onTabChange }: {
  id: ActiveTab; label: string; active: boolean; count: number; countClass?: string
  onTabChange: (tab: ActiveTab) => void
}) {
  return (
    <button type="button" className={`changes-tab ${active ? 'active' : ''}`} onClick={() => onTabChange(id)}>
      {label}
      {count > 0 && <span className={`changes-tab-count ${countClass ?? ''}`}>{count}</span>}
    </button>
  )
}

export default function ChangesPanelTabs({
  activeTab, pendingCount, committedCount, history,
  branchCount, worktreeCount, remoteCount, onTabChange,
}: ChangesPanelTabsProps) {
  const historyCount = history?.length ?? 0

  return (
    <div className="changes-tabs changes-tabs-scrollable">
      <TabButton id="pending" label="Pend." active={activeTab === 'pending'} count={pendingCount} onTabChange={onTabChange} />
      <TabButton id="committed" label="Comm." active={activeTab === 'committed'} count={committedCount} countClass="changes-tab-count-committed" onTabChange={onTabChange} />
      <TabButton id="history" label="Hist." active={activeTab === 'history'} count={historyCount} countClass="changes-tab-count-history" onTabChange={onTabChange} />
      <TabButton id="branches" label="Branch" active={activeTab === 'branches'} count={branchCount} countClass="changes-tab-count-branches" onTabChange={onTabChange} />
      <TabButton id="worktrees" label="Tree" active={activeTab === 'worktrees'} count={worktreeCount} countClass="changes-tab-count-worktrees" onTabChange={onTabChange} />
      <TabButton id="remotes" label="Remote" active={activeTab === 'remotes'} count={remoteCount} countClass="changes-tab-count-remotes" onTabChange={onTabChange} />
    </div>
  )
}
