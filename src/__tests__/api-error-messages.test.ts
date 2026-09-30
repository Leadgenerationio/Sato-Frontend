import { describe, it, expect } from 'vitest';
import { buildErrorMessage, plainIssue } from '@/lib/api';

// Retest R2 (M5 / S16): the server's validation wording reached people as
// "Company number: Too small: expected string to have >=1 characters".
const res = (path: string, message: string, more = 0) => ({
  status: 'error', message: 'Validation failed',
  errors: [{ path, message }, ...Array.from({ length: more }, () => ({ path: 'body.x', message: 'Invalid input' }))],
}) as never;

describe('buildErrorMessage — plain words for common validation wording', () => {
  it('an empty required string reads "<Field> can\'t be empty"', () => {
    expect(buildErrorMessage(res('body.companyNumber', 'Too small: expected string to have >=1 characters'), 'x'))
      .toBe("Couldn't save — Company number can't be empty");
  });
  it('a too-long string says how long it may be', () => {
    expect(buildErrorMessage(res('body.companyNumber', 'Too big: expected string to have <=20 characters'), 'x'))
      .toBe("Couldn't save — Company number is too long (at most 20 characters)");
  });
  it('numbers say the limit', () => {
    expect(plainIssue('Too small: expected number to be >=0')).toBe('must be at least 0');
    expect(plainIssue('Too big: expected number to be <=365')).toBe('must be at most 365');
  });
  it('"Invalid input" reads "isn\'t valid" and the count of others is kept', () => {
    expect(buildErrorMessage(res('body.landingPageUrl', 'Invalid input', 2), 'x'))
      .toBe("Couldn't save — Landing page url isn't valid (and 2 more)");
  });
  it('a message that is already plain is left exactly as the server wrote it', () => {
    expect(buildErrorMessage(res('body.contactEmail', 'Invalid email address'), 'x')).toBe("Couldn't save — Contact email: Invalid email address");
    expect(plainIssue('Switzerland postcodes look like 8001.')).toBeNull();
  });
});
