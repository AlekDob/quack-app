import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GitCommitEntry } from '../types'
import HistoryTab from './HistoryTab'

interface CommitHistoryModalProps {
  branchName: string
  rootPath: string
  onClose: () => void
}

function CommitHistoryModal({ branchName, rootPath, onClose }: CommitHistoryModalProps) {
  const [commits, setCommits] = useState<GitCommitEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCommits = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await invoke<GitCommitEntry[]>('git_commit_history', {
          limit: 100,
          branchName,
          rootPath,
          all: true,
        })
        setCommits(result)
      } catch (err) {
        console.error('Failed to load commit history:', err)
        setError(`Failed to load commits: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    loadCommits()
  }, [branchName, rootPath])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(20, 22, 31, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '760px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f1f2f5' }}>
              Commit History
            </h2>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#a8aebd' }}>
              Branch: <span style={{ color: '#e87d3e', fontWeight: 500 }}>{branchName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#a8aebd',
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {error ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          ) : (
            <HistoryTab
              history={commits}
              historyLoading={loading}
              currentBranch={branchName}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default CommitHistoryModal
