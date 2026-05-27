// Sam (2026-05-27 portal meeting): 'client_admin' added so each client's
// own admin can self-serve user management + agreement upload from inside
// /portal — see Sato-Backend migration 0035 + portal.service.ts.
export type UserRole = 'owner' | 'finance_admin' | 'ops_manager' | 'client' | 'client_admin' | 'readonly';

// Per-portal-user tab visibility (Sam 27-May meeting). null = full access
// (default for existing rows). Only meaningful for role='client' — the
// backend always returns null for client_admin.
export type PortalTabSlug = 'leads' | 'invoices' | 'compliance' | 'creatives' | 'agreement';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string | null;
  clientId: string | null;
  isActive: boolean;
  isPrimaryOwner?: boolean;
  allowedTabs?: PortalTabSlug[] | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiValidationIssue {
  path?: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
  // BE may return validation issues under either `errors` or `issues`. Both
  // arrays follow the same {path, message} shape; we surface them as a
  // multi-line message on ApiError.
  errors?: ApiValidationIssue[];
  issues?: ApiValidationIssue[];
}
