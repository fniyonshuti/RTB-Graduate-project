import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

// Anything React throws while rendering unmounts the whole tree below the
// nearest boundary, which otherwise leaves the user staring at a blank page.
// This is the last line of defense for bugs we didn't anticipate; known
// crash causes should still be fixed at the source.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  handleRecover = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] w-full min-w-0 flex-col items-center justify-center gap-4 rounded-lg border border-rose-200 bg-rose-50 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm">
            <AlertTriangle size={26} />
          </span>
          <div>
            <strong className="block text-lg font-black text-slate-950">
              Something went wrong
            </strong>
            <p className="mt-1 max-w-md text-sm font-bold text-slate-500">
              This section hit an unexpected error. You can try again, or head
              back to a working page.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[#0077B6] bg-[#0077B6] px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-[#0077B6]/15 transition hover:-translate-y-0.5"
            onClick={this.handleRecover}
            type="button"
          >
            <RefreshCw size={16} />
            {this.props.resetLabel || "Try again"}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
