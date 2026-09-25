import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./styles/globals.css";

//  Sentry error monitoring 
// DSN is set via VITE_SENTRY_DSN in .env  add it to activate.
// Safe to deploy without a DSN; Sentry.init() is a no-op when dsn is falsy.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn:              import.meta.env.VITE_SENTRY_DSN,
    environment:      import.meta.env.MODE,           // 'production' or 'development'
    release:          'valerie@0.1.0',
    // Only send errors in production so dev noise doesn't pollute the dashboard
    enabled:          import.meta.env.PROD,
    tracesSampleRate: 0.1,                            // 10% of sessions for performance
    // Scrub any fields that might accidentally contain secrets
    beforeSend(event) {
      if (event.request?.data) {
        const data = event.request.data;
        if (typeof data === 'object') {
          delete data.apiKey;
          delete data.finnhubKey;
          delete data.elevenlabsKey;
          delete data.azureKey;
        }
      }
      return event;
    },
  });
}

//  Root error boundary  Sentry-aware 
const SentryErrorBoundary = Sentry.ErrorBoundary || (({ children }) => children);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SentryErrorBoundary
      fallback={
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          background: '#080c14', color: '#e2e8f0', fontFamily: 'system-ui',
        }}>
          <div style={{ fontSize: 13, color: '#64748b', maxWidth: 420, textAlign: 'center' }}>
            Something crashed. Click reload to recover.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 24px', borderRadius: 8, border: '0.5px solid #1e293b',
              background: '#0f172a', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}
          >
            Reload VALERIE
          </button>
        </div>
      }
    >
      <App />
    </SentryErrorBoundary>
  </React.StrictMode>,
);
