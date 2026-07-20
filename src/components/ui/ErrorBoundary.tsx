/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fullPage?: boolean;
  areaName?: string;
  onReload?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  private reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private reload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const content = (
        <div
          role="alert"
          className="p-5 bg-red-500/10 border border-red-500/40 rounded-lg text-red-400 max-w-xl"
        >
          <h3 className="font-bold mb-2">
            {this.props.areaName ? `${this.props.areaName} could not load` : 'Something went wrong'}
          </h3>
          <p className="text-sm text-black-300 mb-4">
            Your screenplay data is safe. Retry this section or reload the app to recover.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={this.reset} className="btn btn-secondary text-sm">
              Retry Section
            </button>
            <button onClick={this.reload} className="btn btn-primary text-sm">
              Reload App
            </button>
          </div>
        </div>
      );

      if (this.props.fullPage) {
        return <div className="min-h-screen flex items-center justify-center p-6">{content}</div>;
      }
      return content;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
