import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          background: '#080c14', color: '#e2e8f0', fontFamily: 'system-ui',
        }}>
          <div style={{ fontSize: 13, color: '#64748b', maxWidth: 420, textAlign: 'center' }}>
            Something crashed. Click reload to recover.
          </div>
          <div style={{ fontSize: 11, color: '#334155', maxWidth: 420, textAlign: 'center', fontFamily: 'monospace' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 24px', borderRadius: 8, border: '0.5px solid #1e293b',
              background: '#0f172a', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
