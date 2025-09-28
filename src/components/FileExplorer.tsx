import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

const normalize = (value: string) => value.toLowerCase()
const fuzzyMatch = (query: string, target: string) => {
  if (!query) {
    return true
  }
  const normalizedQuery = normalize(query)
  const normalizedTarget = normalize(target)
  let queryIndex = 0
  let targetIndex = 0
  while (queryIndex < normalizedQuery.length && targetIndex < normalizedTarget.length) {
    if (normalizedQuery[queryIndex] === normalizedTarget[targetIndex]) {
      queryIndex += 1
    }
    targetIndex += 1
  }
  return queryIndex === normalizedQuery.length
}

import type { DirectoryEntry } from '../types'

interface FileExplorerProps {
  rootPath: string | null
  tree: Record<string, DirectoryEntry[]>
  loading: boolean
  error: string | null
  activePath: string
  activeFilePath: string | null
  onSelectDirectory: (path: string) => void
  onOpenFile: (entry: DirectoryEntry) => void
  onLoadChildren: (path: string) => Promise<DirectoryEntry[]>
}

export default function FileExplorer({
  rootPath,
  tree,
  loading,
  error,
  activePath,
  activeFilePath,
  onSelectDirectory,
  onOpenFile,
  onLoadChildren,
}: FileExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const rootEntries = useMemo(() => {
    if (!rootPath) {
      return []
    }
    return tree[rootPath] ?? []
  }, [rootPath, tree])

  const rootLabel = useMemo(() => {
    if (!rootPath) {
      return '—'
    }
    const normalized = rootPath.replace(/\\/g, '/')
    const segments = normalized.split('/')
    const candidate = segments.filter(Boolean).pop()
    return candidate ?? normalized
  }, [rootPath])

  useEffect(() => {
    if (!rootPath) {
      return
    }
    setExpanded((previous) => {
      if (previous.has(rootPath)) {
        return previous
      }
      const next = new Set(previous)
      next.add(rootPath)
      return next
    })
  }, [rootPath])

  const ensureExpanded = useCallback((path: string) => {
    setExpanded((previous) => {
      if (previous.has(path)) {
        return previous
      }
      const next = new Set(previous)
      next.add(path)
      return next
    })
  }, [])

  useEffect(() => {
    if (!activePath) {
      return
    }
    const normalized = activePath.replace(/\\/g, '/')
    const segments = normalized.split('/').filter((segment) => segment.length > 0)

    let accumulator = ''
    if (normalized.startsWith('/')) {
      accumulator = '/'
      if (tree[accumulator]) {
        ensureExpanded(accumulator)
      }
    } else if (segments[0]?.includes(':')) {
      accumulator = segments.shift() ?? ''
      if (accumulator && tree[accumulator]) {
        ensureExpanded(accumulator)
      }
    }

    for (const segment of segments) {
      if (accumulator === '' || accumulator === '/') {
        accumulator = accumulator === '/' ? `/${segment}` : segment
      } else {
        accumulator = `${accumulator}/${segment}`
      }
      if (tree[accumulator]) {
        ensureExpanded(accumulator)
      }
    }
  }, [activePath, ensureExpanded, tree])

  const handleToggleDirectory = useCallback(async (entry: DirectoryEntry) => {
    if (!entry.is_dir) {
      return
    }
    const path = entry.path

    if (expanded.has(path)) {
      setExpanded((previous) => {
        if (!previous.has(path)) {
          return previous
        }
        const next = new Set(previous)
        next.delete(path)
        return next
      })
      return
    }

    ensureExpanded(path)

    if (!tree[path]) {
      setLoadingNodes((prev) => {
        const next = new Set(prev)
        next.add(path)
        return next
      })
      await onLoadChildren(path)
      setLoadingNodes((prev) => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
    }
  }, [ensureExpanded, expanded, onLoadChildren, tree])

  const handleDirectorySelect = useCallback((entry: DirectoryEntry) => {
    if (!entry.is_dir) {
      return
    }
    ensureExpanded(entry.path)
    onSelectDirectory(entry.path)
  }, [ensureExpanded, onSelectDirectory])

  const renderEntries = useCallback((entries: DirectoryEntry[], depth = 0) => (
    entries.filter((entry) => fuzzyMatch(query, entry.name)).map((entry) => {
      const isDirectory = entry.is_dir
      const isExpanded = expanded.has(entry.path)
      const isLoadingNode = loadingNodes.has(entry.path)
      const isActiveDirectory = activePath === entry.path
      const isActiveFile = activeFilePath === entry.path
      const paddingLeft = 12 + depth * 14

      const rowClass = [
        'explorer-row',
        isDirectory ? 'directory' : 'file',
        isActiveDirectory || isActiveFile ? 'active' : '',
        isActiveFile ? 'file-open' : '',
      ]
        .filter(Boolean)
        .join(' ')

      return (
        <Fragment key={entry.path}>
          <button
            type="button"
            className={rowClass}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => {
              if (isDirectory) {
                handleDirectorySelect(entry)
              } else {
                onOpenFile(entry)
              }
            }}
          >
            <span
              className={`explorer-expander ${
                isDirectory ? (isExpanded ? 'open' : '') : 'placeholder'
              } ${isLoadingNode ? 'loading' : ''}`}
              onClick={(event) => {
                if (!isDirectory) {
                  return
                }
                event.stopPropagation()
                void handleToggleDirectory(entry)
              }}
              aria-hidden="true"
            />
            <span
              className={`explorer-icon ${
                isDirectory ? 'folder' : entry.is_symlink ? 'symlink' : 'file'
              }`}
              aria-hidden="true"
            />
            <span className="explorer-name">{entry.name}</span>
          </button>
          {isDirectory && isExpanded && tree[entry.path] && tree[entry.path].length > 0 && (
            renderEntries(tree[entry.path], depth + 1)
          )}
        </Fragment>
      )
    })
  ), [activeFilePath, activePath, expanded, handleDirectorySelect, handleToggleDirectory, loadingNodes, onOpenFile, query, tree])

  return (
    <aside className="file-explorer">
      <div className="explorer-header">
        <h2 className="explorer-title">Esplora file</h2>
        <span className="explorer-path">{activePath}</span>
        {error && <span className="explorer-error">{error}</span>}
        <input
          className="explorer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca file o cartelle"
        />
      </div>

      <div className={`explorer-content ${loading ? 'loading' : ''}`}>
        {rootPath && (
          <div className="explorer-root-label">{rootLabel}</div>
        )}
        {(!rootEntries || rootEntries.length === 0) && !loading ? (
          <div className="empty-state">Cartella vuota</div>
        ) : (
          <div className="explorer-tree">
            {rootEntries && renderEntries(rootEntries)}
          </div>
        )}
      </div>
    </aside>
  )
}
