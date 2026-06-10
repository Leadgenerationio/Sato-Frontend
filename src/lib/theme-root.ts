// Radix overlays (Dialog/Popover/DropdownMenu/Sheet) render into a React portal
// attached to <body> by default — which is OUTSIDE the scoped Statto theme
// wrappers (.statto-admin / .statto-portal). Any Statto-classed markup inside
// them (e.g. .nc-input form fields) therefore renders unstyled.
//
// Returning the currently-mounted themed root as the portal `container` makes
// that content render INSIDE the scope, so the scoped CSS applies. Only one
// shell is mounted at a time; falls back to undefined (Radix default = body)
// when neither is present (e.g. the bare login route before the shell mounts).
export function getThemeRoot(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return (document.querySelector('.statto-admin, .statto-portal') as HTMLElement | null) ?? undefined;
}
