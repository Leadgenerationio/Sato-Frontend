import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateLink {
  label: string;
  to: string;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  link?: EmptyStateLink;
  /** "default" = card-sized; "compact" = small inline (widgets); "page" = large centered. */
  size?: 'compact' | 'default' | 'page';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  link,
  size = 'default',
  className,
}: EmptyStateProps) {
  const padding =
    size === 'compact' ? 'py-6' : size === 'page' ? 'py-16' : 'py-12';
  const iconSize = size === 'compact' ? 'size-6' : size === 'page' ? 'size-12' : 'size-8';
  const iconWrap =
    size === 'compact' ? 'size-10' : size === 'page' ? 'size-16' : 'size-14';
  const titleSize =
    size === 'compact' ? 'text-sm' : size === 'page' ? 'text-lg' : 'text-base';

  const ActionIcon = action?.icon;
  const LinkIcon = link?.icon;

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
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          iconWrap,
        )}
      >
        <Icon className={iconSize} />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={cn('font-medium text-foreground', titleSize)}>{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} size={size === 'compact' ? 'sm' : 'default'}>
          {ActionIcon && <ActionIcon className="size-4" />}
          {action.label}
        </Button>
      )}
      {link && (
        <Button asChild size={size === 'compact' ? 'sm' : 'default'}>
          <Link to={link.to}>
            {LinkIcon && <LinkIcon className="size-4" />}
            {link.label}
          </Link>
        </Button>
      )}
    </div>
  );
}
