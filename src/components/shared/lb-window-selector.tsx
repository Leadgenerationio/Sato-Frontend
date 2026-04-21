import { Button } from '@/components/ui/button';
import { LB_WINDOW_LABELS, type LbWindow } from '@/lib/hooks/use-leadbyte';

const ORDER: LbWindow[] = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'ytd'];

interface Props {
  value: LbWindow;
  onChange: (w: LbWindow) => void;
  className?: string;
}

export function LbWindowSelector({ value, onChange, className }: Props) {
  return (
    <div className={`inline-flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1 ${className ?? ''}`}>
      {ORDER.map((w) => (
        <Button
          key={w}
          variant={value === w ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs font-medium"
          onClick={() => onChange(w)}
          aria-pressed={value === w}
          data-testid={`lb-window-${w}`}
        >
          {LB_WINDOW_LABELS[w]}
        </Button>
      ))}
    </div>
  );
}
