'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message:  string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const isEngineDown =
      this.state.message.includes('503') ||
      this.state.message.includes('502') ||
      this.state.message.includes('Engine') ||
      this.state.message.includes('fetch');

    return (
      <div
        className="w-full flex flex-col items-center justify-center min-h-[480px] px-6 text-center"
        style={{ background: 'var(--canvas)' }}
        role="alert"
      >
        <div className="w-8 h-8 rounded-full border border-red-500/20 flex items-center justify-center mb-5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
               style={{ color: 'var(--heat-3)' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-2"
           style={{ color: 'var(--heat-3)' }}>
          {isEngineDown ? 'Engine unavailable' : 'Unexpected error'}
        </p>

        <p className="font-mono text-[11px] max-w-sm mb-1" style={{ color: 'var(--text-2)' }}>
          {isEngineDown
            ? 'The climate engine is temporarily unreachable. This is usually a cold-start delay on HuggingFace — it resolves in under 60 seconds.'
            : 'A rendering error occurred. No data was lost.'}
        </p>

        {this.state.message && (
          <p className="font-mono text-[9px] italic mt-1 mb-5 max-w-md" style={{ color: 'var(--muted)' }}>
            {this.state.message}
          </p>
        )}

        <button
          onClick={this.handleRetry}
          className="font-mono text-[10px] uppercase tracking-[0.2em] px-5 py-2.5 transition-colors duration-150 hover:text-white mt-2"
          style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)', background: 'var(--raised)' }}
        >
          Retry
        </button>
      </div>
    );
  }
}
