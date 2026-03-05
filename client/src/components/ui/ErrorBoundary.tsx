import { Component, ReactNode, ErrorInfo } from 'react';
import { RefreshCw, Zap } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary — catches uncaught render errors, restores body
 * overflow (in case a modal was open when the crash happened), and shows a
 * recoverable UI instead of leaving the user on a blank / unresponsive page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TaskFlow] Uncaught render error:', error, info);
    // Safety: ensure body scroll is never permanently locked after a crash
    document.body.style.overflow = '';
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-8 text-center dark:bg-slate-950">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/10">
            <Zap className="h-8 w-8 text-red-500" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Something went wrong
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">
              An unexpected error occurred. You can try again or refresh the page.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh page
            </button>
          </div>

          {this.state.error && (
            <p className="max-w-md truncate font-mono text-xs text-slate-400">
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
