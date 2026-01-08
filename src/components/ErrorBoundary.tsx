import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: { componentStack?: string } | null
  lastCrash: string | null
  copied: boolean
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      lastCrash: null,
      copied: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Check for previous crash data in localStorage
    const lastCrash = localStorage.getItem('quack_last_crash')

    this.setState({
      error,
      errorInfo,
      lastCrash,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      lastCrash: null,
      copied: false,
    })
  }

  handleCopyError = async () => {
    const errorDetails = this.getErrorDetails()
    try {
      await navigator.clipboard.writeText(errorDetails)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }

  handleClearAndReload = () => {
    localStorage.removeItem('quack_last_crash')
    window.location.reload()
  }

  getErrorDetails = (): string => {
    const { error, errorInfo, lastCrash } = this.state
    const timestamp = new Date().toISOString()

    let details = `Quack App Error Report
Generated: ${timestamp}

=== Current Error ===
${error?.toString() || 'Unknown error'}

=== Component Stack ===
${errorInfo?.componentStack || 'No stack trace available'}
`

    if (lastCrash) {
      details += `

=== Previous Crash Data ===
${lastCrash}
`
    }

    return details
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="app-fallback">
          <div className="fallback-card" style={{ maxWidth: '700px' }}>
            <h1>⚠️ Something went wrong</h1>
            <p style={{ marginTop: '16px', color: '#f28c52' }}>
              The app encountered an unexpected error and crashed.
            </p>

            {this.state.error && (
              <div style={{ marginTop: '24px' }}>
                <details style={{ textAlign: 'left' }} open>
                  <summary style={{ cursor: 'pointer', fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>
                    Current Error
                  </summary>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    border: '1px solid rgba(242, 140, 82, 0.3)',
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            {this.state.lastCrash && (
              <div style={{ marginTop: '16px' }}>
                <details style={{ textAlign: 'left' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '600', marginBottom: '12px', fontSize: '15px', color: '#ff9966' }}>
                    Previous Crash Data
                  </summary>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    border: '1px solid rgba(255, 153, 102, 0.3)',
                  }}>
                    {this.state.lastCrash}
                  </pre>
                </details>
              </div>
            )}

            <div style={{
              marginTop: '24px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <button
                type="button"
                onClick={this.handleCopyError}
                style={{
                  padding: '10px 20px',
                  background: this.state.copied ? '#00D9FF' : '#004E89',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {this.state.copied ? '✓ Copied!' : 'Copy Error Details'}
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  background: '#f28c52',
                  color: '#080a0d',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReload}
                style={{
                  padding: '10px 20px',
                  background: '#1a1d24',
                  color: '#f28c52',
                  border: '1px solid #f28c52',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Clear and Reload
              </button>
            </div>

            <p style={{ marginTop: '16px', fontSize: '14px', opacity: '0.7' }}>
              Copy the error details to share with support or clear the crash data and reload the app.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
