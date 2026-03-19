import './InlineDiffView.css'

interface InlineDiffViewProps {
  diffContent: string
  loading?: boolean
  error?: string | null
  compact?: boolean
}

export default function InlineDiffView({
  diffContent,
  loading = false,
  error = null,
  compact = false,
}: InlineDiffViewProps) {
  if (loading) {
    return <div className="inline-diff-empty">Computing diff…</div>
  }

  if (error) {
    return <div className="inline-diff-error">{error}</div>
  }

  if (!diffContent || diffContent.trim() === '') {
    return (
      <div className="inline-diff-empty">
        No changes to display.
      </div>
    )
  }

  const lines = diffContent.split('\n')
  let oldLineNum = 0
  let newLineNum = 0

  return (
    <div className={`inline-diff ${compact ? 'inline-diff-compact' : ''}`}>
      {lines.map((line, index) => {
        const isAddition = line.startsWith('+') && !line.startsWith('+++')
        const isDeletion = line.startsWith('-') && !line.startsWith('---')
        const isHunkHeader = line.startsWith('@@')
        const isMeta =
          isHunkHeader ||
          line.startsWith('diff ') ||
          line.startsWith('index ') ||
          line.startsWith('---') ||
          line.startsWith('+++')

        if (isHunkHeader) {
          const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
          if (match) {
            oldLineNum = parseInt(match[1], 10)
            newLineNum = parseInt(match[2], 10)
          }
        }

        let displayOldLine: string | number = ''
        let displayNewLine: string | number = ''

        if (!isMeta) {
          if (isAddition) {
            displayNewLine = newLineNum
            newLineNum++
          } else if (isDeletion) {
            displayOldLine = oldLineNum
            oldLineNum++
          } else {
            displayOldLine = oldLineNum
            displayNewLine = newLineNum
            oldLineNum++
            newLineNum++
          }
        }

        const content = isAddition || isDeletion ? line.slice(1) : line
        const displayText = content.length > 0 ? content : '\u00a0'

        let lineClass = 'diff-line'
        if (isAddition) lineClass += ' diff-line-addition'
        else if (isDeletion) lineClass += ' diff-line-deletion'
        else if (isMeta) lineClass += ' diff-line-meta'

        return (
          <div key={`${index}-${line}`} className={lineClass}>
            {!compact && (
              <>
                <span className="diff-line-number diff-line-old">
                  {displayOldLine}
                </span>
                <span className="diff-line-number diff-line-new">
                  {displayNewLine}
                </span>
              </>
            )}
            {compact && !isMeta && (
              <span className="diff-line-indicator">
                {isAddition ? '+' : isDeletion ? '-' : ' '}
              </span>
            )}
            <span className="diff-line-content">{displayText}</span>
          </div>
        )
      })}
    </div>
  )
}
