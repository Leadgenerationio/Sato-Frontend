import { useEffect } from 'react';

// Set the browser tab title so multi-tab portal navigation is unambiguous.
// Restores the previous title on unmount so admin pages keep their default.
export function usePageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
