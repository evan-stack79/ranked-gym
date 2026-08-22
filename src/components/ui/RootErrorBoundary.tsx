import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Ranked Gym] render crash:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0C0C0E',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem 1.25rem',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ranked Gym</h1>
          <p style={{ marginTop: '0.75rem', color: '#FF6961', fontSize: '0.9375rem' }}>
            Erreur au démarrage — recharge la page.
          </p>
          <pre
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '12px',
              background: '#1C1C1E',
              color: '#8E8E93',
              fontSize: '0.75rem',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.25rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '999px',
              border: 'none',
              background: '#FF2B2B',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Recharger
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
