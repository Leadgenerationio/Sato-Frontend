import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  icon?: LucideIcon;
  size?: 'compact' | 'default' | 'page';
  className?: string;
}

function messageFromError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return null;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  icon: Icon = AlertTriangle,
  size = 'default',
  className,
}: ErrorStateProps) {
  const padding = size === 'compact' ? 'py-6' : size === 'page' ? 'py-16' : 'py-12';
  const iconSize = size === 'compact' ? 'size-6' : size === 'page' ? 'size-12' : 'size-8';
  const iconWrap = size === 'compact' ? 'size-10' : size === 'page' ? 'size-16' : 'size-14';
  const titleSize = size === 'compact' ? 'text-sm' : size === 'page' ? 'text-lg' : 'text-base';

  const errMsg = messageFromError(error);
  const detail = description ?? errMsg ?? 'Try again, or refresh the page if the issue keeps happening.';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-4 text-center',
        padding,
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-negative/10 text-negative',
          iconWrap,
        )}
      >
        <Icon className={iconSize} />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={cn('font-medium text-foreground', titleSize)}>{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{detail}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size={size === 'compact' ? 'sm' : 'default'} onClick={onRetry} className="gap-2">
          <RefreshCw className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
