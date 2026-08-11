import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, Download, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'dsa-roadmap:v1';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// The app's only data store is the browser, so a render crash must never be a dead end: the
// fallback keeps a way to reload and a way to download the raw persisted payload. Reading
// localStorage directly here is a deliberate exception to the "UI never touches localStorage"
// rule — the boundary must still work when the store layer itself is what crashed.
function downloadBackup(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dsa-roadmap-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Storage unavailable — nothing to offer, the reload path remains.
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="glass mx-auto my-10 flex w-full max-w-lg flex-col items-center gap-4 p-8 text-center">
        <TriangleAlert className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
        <div>
          <h1 className="font-serif text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This view hit an unexpected error. Your progress is stored locally and is not affected.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw /> Reload
          </Button>
          <Button variant="outline" onClick={downloadBackup}>
            <Download /> Download backup
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
