import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, stack: null }
  }
  static getDerivedStateFromError(err) {
    return { error: err }
  }
  componentDidCatch(err, info) {
    this.setState({ stack: info?.componentStack || '' })
    console.error('React render error:', err, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px', fontFamily: 'DM Mono, monospace', fontSize: 12,
          background: '#fff8f6', color: '#c0392b', lineHeight: 1.6,
          minHeight: '100vh', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            Render error
          </div>
          <div style={{ marginBottom: 16 }}>{String(this.state.error)}</div>
          {this.state.stack && (
            <div style={{ color: '#444', fontSize: 11, borderTop: '1px solid #fcc', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Component stack:</div>
              <div>{this.state.stack}</div>
            </div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
