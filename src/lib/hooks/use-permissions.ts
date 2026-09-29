import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { UserRole } from '@/types';

// Role Access Matrix (Sam feedback round 1, S7). The backend stores the
// matrix per business and enforces it on the API; the sidebar asks it which
// sections this user may open so the menu and the server agree.

/** Cell of the matrix: always (Owner / locked), on/off (switchable), none (never available to this role). */
export type SectionAccess = 'always' | 'on' | 'off' | 'none';

export interface MatrixSection {
  key: string;
  label: string;
  group: string;
  locked: boolean;
  access: Record<UserRole, SectionAccess>;
}

export function useMySections(enabled = true) {
  return useQuery({
    queryKey: ['permissions', 'me'],
    queryFn: async () => unwrap(await api.get<{ role: UserRole; sections: string[] }>('/api/v1/permissions/me')).sections,
    enabled,
    staleTime: 60_000,
    // A failed call must not empty the menu — the sidebar falls back to the
    // static role lists (the route guards) when this has no data.
    retry: 1,
  });
}
