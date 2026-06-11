import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { getThemeRoot } from '@/lib/theme-root';

// Custom Statto-styled select to match the dashboard "Time range" dropdown:
// an .nc-select-styled trigger + a light .range-menu popover with the selected
// option highlighted in lime. Drop-in replacement for a native <select> where
// the OS-drawn option list can't be styled.
//
// The menu is rendered in a FIXED-position portal into the themed root, so it
// is never clipped by overflow/scroll containers (e.g. inside a table). It
// repositions on scroll/resize, supports full keyboard operation (arrows /
// Home / End / Enter / Esc), and closes on outside-click. The .range-menu /
// .range-opt menu styles are defined in BOTH admin-theme.css and
// portal-theme.css so the menu renders correctly in either scope.

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Capitalise the trigger + option labels (e.g. priority values). */
  capitalize?: boolean;
  /** Dim the trigger label (e.g. an "uncategorised"/empty selection). */
  muted?: boolean;
  /** Extra class on the wrapper. */
  className?: string;
  /** Inline style on the wrapper (e.g. width constraints). */
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function FilterSelect({ value, options, onChange, ariaLabel, capitalize, muted, className, style, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // A disabled control must never stay open.
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  // Position the portaled menu against the trigger's viewport rect, and keep it
  // attached on scroll/resize (recompute rather than close).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // Outside-click closes.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // On open, point the active option at the current value and focus it.
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActiveIndex(idx);
    // Focus after the portal renders.
    const id = window.requestAnimationFrame(() => optRefs.current[idx]?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (v: string) => {
    if (v !== value) onChange(v); // no-op re-selects don't fire onChange (matches <select>)
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (next: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, next));
    setActiveIndex(clamped);
    optRefs.current[clamped]?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveActive(activeIndex + 1); break;
      case 'ArrowUp': e.preventDefault(); moveActive(activeIndex - 1); break;
      case 'Home': e.preventDefault(); moveActive(0); break;
      case 'End': e.preventDefault(); moveActive(options.length - 1); break;
      case 'Enter': case ' ': e.preventDefault(); select(options[activeIndex]?.value ?? value); break;
      case 'Escape': e.preventDefault(); setOpen(false); triggerRef.current?.focus(); break;
      case 'Tab': setOpen(false); break;
      default: break;
    }
  };

  const current = options.find((o) => o.value === value);
  const cap = capitalize ? { textTransform: 'capitalize' as const } : undefined;
  const root = getThemeRoot() ?? document.body;

  return (
    <div className={'nc-select-wrap tk-dd' + (className ? ` ${className}` : '')} ref={wrapRef} style={style}>
      <button
        ref={triggerRef}
        type="button"
        className={'nc-select' + (muted ? ' nc-muted' : '')}
        style={{ textAlign: 'left', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(disabled ? { opacity: 0.6, cursor: 'default' } : null), ...cap }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        {current?.label ?? ''}
      </button>
      <ChevronDown className="size-[15px]" />
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="range-menu"
          role="listbox"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', top: pos.top, left: pos.left, right: 'auto', width: pos.width, minWidth: 'auto', maxHeight: 320, overflowY: 'auto', zIndex: 1000 }}
        >
          {options.map((o, i) => (
            <button
              type="button"
              key={o.value}
              ref={(el) => { optRefs.current[i] = el; }}
              role="option"
              aria-selected={o.value === value}
              className={'range-opt' + (o.value === value ? ' on' : '')}
              style={{ whiteSpace: 'normal', ...cap }}
              onClick={() => select(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>,
        root,
      )}
    </div>
  );
}
