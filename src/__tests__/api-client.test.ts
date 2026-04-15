import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, ApiError } from '../lib/api';

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
});
