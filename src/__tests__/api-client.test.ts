import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, ApiError, NETWORK_ERROR_MESSAGE } from '../lib/api';

describe('API Client', () => {
  beforeEach(() => {
    api.setToken(null);
    vi.restoreAllMocks();
  });

  it('adds Authorization header when token is set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 }),
    );

    api.setToken('test-token');
    await api.get('/test');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('does not add Authorization header without token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 }),
    );

    await api.get('/test');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('sends JSON content type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 }),
    );

    await api.post('/test', { key: 'value' });

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws ApiError on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })),
    );

    try {
      await api.get('/missing');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('Not found');
      expect((err as ApiError).status).toBe(404);
    }
  });

  it('sends body as JSON string for POST', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 }),
    );

    await api.post('/test', { email: 'test@test.com' });

    const body = fetchSpy.mock.calls[0][1]?.body;
    expect(body).toBe(JSON.stringify({ email: 'test@test.com' }));
  });

  it('uses correct HTTP methods', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 })),
    );

    await api.get('/test');
    expect(fetchSpy.mock.calls[0][1]?.method).toBe('GET');

    await api.post('/test');
    expect(fetchSpy.mock.calls[1][1]?.method).toBe('POST');

    await api.put('/test');
    expect(fetchSpy.mock.calls[2][1]?.method).toBe('PUT');

    await api.delete('/test');
    expect(fetchSpy.mock.calls[3][1]?.method).toBe('DELETE');
  });

  // Sam feedback S10: every failed save said "Failed to fetch".
  describe('plain-words errors (S10)', () => {
    it('a dropped connection says the server was unreachable and nothing saved', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
      const err = await api.put('/api/v1/clients/1', { a: 1 }).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe(NETWORK_ERROR_MESSAGE);
      expect(err.message).not.toMatch(/failed to fetch/i);
      expect(err.message).toMatch(/nothing was saved/);
      expect(err.status).toBe(0);
    });

    it('validation errors lead with the first field in plain words', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        status: 'error',
        message: 'Validation failed',
        errors: [
          { path: 'body.contactEmail', message: 'Invalid email address' },
          { path: 'body.contacts.0.name', message: 'Required' },
        ],
      }), { status: 400 }));
      const err = await api.post('/api/v1/clients', {}).catch((e) => e);
      expect(err.message).toBe("Couldn't save — Contact email: Invalid email address (and 1 more)");
    });

    it('handles zod-style array paths', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        status: 'error', message: 'Invalid input', issues: [{ path: ['sizeBytes'], message: 'Too big' }],
      }), { status: 400 }));
      const err = await api.post('/api/v1/uploads/presign', {}).catch((e) => e);
      expect(err.message).toBe("Couldn't save — Size bytes: Too big");
    });

    it('prefers the server message, falls back to plain words per status', async () => {
      const cases: Array<[number, RegExp]> = [
        [403, /permission/], [404, /couldn't find/], [409, /changed or already exists/],
        [413, /too large/], [429, /wait a moment/], [500, /nothing was saved/], [503, /nothing was saved/],
      ];
      for (const [status, re] of cases) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ status: 'error' }), { status }));
        const err = await api.get('/x').catch((e) => e);
        expect(err.message, String(status)).toMatch(re);
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'error', message: 'Client not found' }), { status: 404 }),
      );
      expect((await api.get('/x').catch((e) => e)).message).toBe('Client not found');
    });

    it('a non-JSON 502 page still gets a plain message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
      const err = await api.get('/x').catch((e) => e);
      expect(err.message).toMatch(/Something went wrong on the server/);
    });
  });
});
