export type UserRole = 'owner' | 'finance_admin' | 'ops_manager' | 'client' | 'readonly';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string | null;
  clientId: string | null;
  isActive: boolean;
  isPrimaryOwner?: boolean;
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
