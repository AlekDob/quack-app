import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: { componentStack?: string } | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
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

    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
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
          <div className="fallback-card" style={{ maxWidth: '600px' }}>
            <h1>⚠️ Something went wrong</h1>
            <p style={{ marginTop: '16px', color: '#f28c52' }}>
              The app encountered an unexpected error and crashed.
            </p>

            {this.state.error && (
              <div style={{ marginTop: '24px' }}>
                <details style={{ textAlign: 'left' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '600', marginBottom: '8px' }}>
                    Error details
                  </summary>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '300px',
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              style={{
                marginTop: '24px',
                padding: '10px 20px',
                background: '#f28c52',
                color: '#080a0d',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>

            <p style={{ marginTop: '16px', fontSize: '14px', opacity: '0.7' }}>
              If the error persists, try restarting the app.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
