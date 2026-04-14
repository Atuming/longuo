import { Component } from 'react';
import type { CSSProperties, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    gap: '12px',
    minHeight: '120px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--color-text, #333)',
    margin: 0,
  },
  message: {
    fontSize: '14px',
    color: 'var(--color-text-secondary, #666)',
    margin: 0,
    maxWidth: '480px',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  retryButton: {
    marginTop: '8px',
    height: '36px',
    borderRadius: 'var(--radius, 6px)',
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-accent, #6366f1)',
    background: 'var(--color-accent, #6366f1)',
    color: '#FFFFFF',
    transition: 'opacity 0.15s',
  },
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? '出错了';
      return (
        <div style={styles.container}>
          <p style={styles.title}>{title}</p>
          <p style={styles.message}>{this.state.error?.message}</p>
          <button style={styles.retryButton} onClick={this.handleRetry}>
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
export type { ErrorBoundaryProps, ErrorBoundaryState };
