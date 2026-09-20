import { Component, type ErrorInfo, type ReactNode } from 'react'
import { USER_CRASH_BODY, USER_CRASH_TITLE, USER_RELOAD_LABEL } from '../../boot/bootUiCopy'
import { safeError } from '../../utils/safeLog'

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
    safeError('[Ranked Gym] render crash', { error, componentStack: info.componentStack })
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
          data-boot-crash="1"
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ranked Gym</h1>
          <p style={{ marginTop: '0.75rem', fontSize: '1.05rem', fontWeight: 600 }}>{USER_CRASH_TITLE}</p>
          <p style={{ marginTop: '0.5rem', color: '#AEAEB2', fontSize: '0.9375rem' }}>{USER_CRASH_BODY}</p>
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
            {USER_RELOAD_LABEL}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
