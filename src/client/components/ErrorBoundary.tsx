import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React application:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg p-6 shadow-[4px_4px_0px_rgba(29,28,26,0.9)] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 border-2 border-red-800 flex items-center justify-center mx-auto text-red-800">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[#1D1C1A]">Er is een weergavefout opgetreden</h1>
              <p className="text-xs text-[#4c5752] mt-1 font-medium">
                De cockpit interface kon niet correct worden geladen. Probeer de pagina opnieuw te laden.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded p-2.5 text-[11px] font-mono text-left text-red-900 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border-2 border-[#1D1C1A] bg-[#006448] text-white font-extrabold text-sm shadow-[2px_2px_0px_rgba(29,28,26,0.9)] hover:bg-[#00523b] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Pagina opnieuw laden</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
