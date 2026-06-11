import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
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
  // Keep the CTA proportional to the empty-state size (compact widgets get the
  // smaller button), matching the pre-restyle behaviour.
  const btnClass = 'btn b-dark' + (size === 'compact' ? ' b-sm' : '');

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
          'flex items-center justify-center rounded-full',
          iconWrap,
        )}
        style={{ background: 'var(--gray-50)', color: 'var(--statto-ink)' }}
      >
        <Icon className={iconSize} />
      </div>
      <div className="flex flex-col gap-1">
        <h3
          className={cn('font-semibold', titleSize)}
          style={{ color: 'var(--fg1)' }}
        >
          {title}
        </h3>
        {description && (
          <p className="max-w-sm text-sm" style={{ color: 'var(--fg2)' }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <button type="button" className={btnClass} onClick={action.onClick}>
          {ActionIcon && <ActionIcon className="size-4" />}
          {action.label}
        </button>
      )}
      {link && (
        <Link to={link.to} className={btnClass}>
          {LinkIcon && <LinkIcon className="size-4" />}
          {link.label}
        </Link>
      )}
    </div>
  );
}
