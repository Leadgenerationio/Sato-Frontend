import { Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Skeleton fallback for widgets ───
export function WidgetSkeleton({ className, height = 'h-[300px]' }: { className?: string; height?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className={`w-full ${height}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Error boundary ───
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Widget error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
              <AlertTriangle className="size-8" />
              <p className="text-sm">Failed to load widget</p>
              <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false })}>
                <RefreshCw className="size-3 mr-1.5" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// ─── Widget container: Suspense + ErrorBoundary ───
interface WidgetContainerProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

export function WidgetContainer({ children, fallback, className }: WidgetContainerProps) {
  return (
    <WidgetErrorBoundary>
      <Suspense fallback={fallback || <WidgetSkeleton className={className} />}>
        {children}
      </Suspense>
    </WidgetErrorBoundary>
  );
}
