/**
 * Creative library (Sam round 1, M2): browser-side file checks, SHA-256
 * fingerprint and landing-page URL normalisation.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_CREATIVE_BYTES, creativeFileError, landingUrlError, mediaTypeOf, normaliseLandingUrl, sha256Hex,
} from '@/lib/creative-files';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('creativeFileError', () => {
  it('accepts images and videos', () => {
    expect(creativeFileError(f('ad.png', 'image/png'))).toBeNull();
    expect(creativeFileError(f('ad.mp4', 'video/mp4'))).toBeNull();
    expect(creativeFileError(f('ad.webm', ''))).toBeNull();
  });
  it('refuses anything else in plain words (S9: a .exe got as far as the upload)', () => {
    expect(creativeFileError(f('setup.exe', 'application/x-msdownload'))).toBe('setup.exe: only images and videos can be uploaded as creatives.');
    expect(creativeFileError(f('copy.pdf', 'application/pdf'))).toMatch(/only images and videos/);
  });
  it('refuses files over 50 MB with the limit in the message', () => {
    expect(creativeFileError(f('big.mp4', 'video/mp4', MAX_CREATIVE_BYTES + 1))).toBe('big.mp4: file too large (50 MB) — max 50 MB.');
    expect(creativeFileError(f('ok.mp4', 'video/mp4', MAX_CREATIVE_BYTES))).toBeNull();
  });
  it('refuses empty files', () => {
    expect(creativeFileError(f('e.png', 'image/png', 0))).toMatch(/empty/);
  });
  it('mediaTypeOf tells image from video', () => {
    expect(mediaTypeOf(f('a.jpg', 'image/jpeg'))).toBe('image');
    expect(mediaTypeOf(f('a.mov', ''))).toBe('video');
    expect(mediaTypeOf(f('a.txt', 'text/plain'))).toBeNull();
  });
});

describe('sha256Hex', () => {
  it('matches the known SHA-256 of "abc"', async () => {
    expect(await sha256Hex(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('normaliseLandingUrl', () => {
  it('lower-cases the host and strips tracking parameters', () => {
    expect(normaliseLandingUrl('https://Offers.Example.COM/hearing?utm_source=fb&fbclid=abc&gclid=x&ref=1'))
      .toBe('https://offers.example.com/hearing?ref=1');
  });
  it('treats the same page from two ads as one URL', () => {
    const a = normaliseLandingUrl('https://example.com/offer/?utm_campaign=a');
    const b = normaliseLandingUrl('example.com/offer#top');
    expect(a).toBe('https://example.com/offer');
    expect(b).toBe(a);
  });
  it('keeps the root without a trailing slash', () => {
    expect(normaliseLandingUrl('https://example.com/')).toBe('https://example.com');
  });
  it('rejects things that are not web pages', () => {
    expect(normaliseLandingUrl('javascript:alert(1)')).toBeNull();
    expect(normaliseLandingUrl('not a url')).toBeNull();
    expect(normaliseLandingUrl('localhost')).toBeNull();
    expect(normaliseLandingUrl('')).toBeNull();
  });
  it('landingUrlError explains what to type', () => {
    expect(landingUrlError('')).toBe('Enter the landing page URL.');
    expect(landingUrlError('nope')).toMatch(/isn't a web address/);
    expect(landingUrlError('https://example.com/x')).toBeNull();
  });
});
