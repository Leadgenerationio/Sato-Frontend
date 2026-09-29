import { describe, it, expect } from 'vitest';
import { formatActivityDiff, activityFieldLabel } from '@/lib/client-activity-format';

// Feedback S3 (29 Sep 2026): show what changed, not every field name.
describe('formatActivityDiff()', () => {
  it('renders booleans, enums and blanks readably', () => {
    expect(formatActivityDiff({
      vatRegistered: { from: false, to: true },
      status: { from: 'onboarding', to: 'paused' },
      vatTreatment: { from: 'uk_standard', to: 'reverse_charge' },
      vatNumber: { from: null, to: 'PL123' },
    })).toEqual([
      { field: 'vatRegistered', label: 'VAT Registered', from: 'No', to: 'Yes' },
      { field: 'status', label: 'Client status', from: 'Onboarding', to: 'Paused' },
      { field: 'vatTreatment', label: 'VAT treatment', from: 'UK VAT (standard rate)', to: 'Reverse charge (EU / international B2B)' },
      { field: 'vatNumber', label: 'VAT number', from: '—', to: 'PL123' },
    ]);
  });

  it('returns nothing for a missing or malformed diff (older activity rows)', () => {
    expect(formatActivityDiff(undefined)).toEqual([]);
    expect(formatActivityDiff(['companyName'])).toEqual([]);
    expect(formatActivityDiff({ companyName: 'x' })).toEqual([]);
  });

  it('humanises an unknown field name instead of printing camelCase', () => {
    expect(activityFieldLabel('someNewField')).toBe('Some New Field');
  });
});
