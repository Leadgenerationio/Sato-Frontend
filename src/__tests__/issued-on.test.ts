import { describe, it, expect } from 'vitest';
import { issuedOn } from '../lib/hooks/use-invoices';

describe('issuedOn (Sam S12)', () => {
  it('uses the issue date when the backend sends one', () => {
    expect(issuedOn({ issueDate: '2024-04-25T00:00:00Z', createdAt: '2026-09-29T10:00:00Z' })).toBe('2024-04-25T00:00:00Z');
  });
  it('null means "not known yet": no fallback to the import date', () => {
    expect(issuedOn({ issueDate: null, createdAt: '2026-09-29T10:00:00Z' })).toBeNull();
  });
  it('a backend that predates the field keeps showing createdAt as before', () => {
    expect(issuedOn({ createdAt: '2026-09-29T10:00:00Z' })).toBe('2026-09-29T10:00:00Z');
  });
});
