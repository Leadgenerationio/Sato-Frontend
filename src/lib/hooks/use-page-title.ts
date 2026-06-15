import { useEffect } from 'react';
import { brand } from '@/config/brand';

// Set the browser tab title so multi-tab portal navigation is unambiguous.
// Restores the previous title on unmount so admin pages keep their default.
//
// Sam 2026-06-15: clients must never see "Stato". Portal pages pass titles like
// "Stato — Dashboard"; swap the leading "Stato" for the resolved client brand
// (e.g. "leadgeneration.io — Dashboard") centrally so every portal tab is
// branded without touching each page.
export function usePageTitle(title: string): void {
  const branded = title.replace(/^Stato\b/, brand.name);
  useEffect(() => {
    const previous = document.title;
    document.title = branded;
    return () => {
      document.title = previous;
    };
  }, [branded]);
}
