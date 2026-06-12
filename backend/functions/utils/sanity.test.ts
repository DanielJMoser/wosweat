import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchEditorial } from './sanity';

const okBody = {
    result: {
        custom: [{ _id: 'a', title: 'T', date: '2026-07-01', venue: 'Hofgarten' }],
        recs: [{ venue: 'PMK Innsbruck', date: '2026-07-01', titleContains: 'molchat' }],
    },
};

const mockFetch = (impl: () => Promise<Response>) => {
    // vi.fn(impl) would type mock.calls as [] (vitest 3 uses Parameters<T>) — declare fetch's params explicitly
    const spy = vi.fn((..._args: Parameters<typeof fetch>) => impl());
    vi.stubGlobal('fetch', spy);
    return spy;
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('fetchEditorial', () => {
    test('returns null without fetching when SANITY_PROJECT_ID is unset', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', '');
        const spy = mockFetch(() => Promise.resolve(new Response('{}')));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    test('returns parsed content on 200 and queries the CDN host with the date param', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        const spy = mockFetch(() => Promise.resolve(new Response(JSON.stringify(okBody))));
        const content = await fetchEditorial('2026-06-12');
        expect(content).toEqual(okBody.result);
        const url = String(spy.mock.calls[0][0]);
        expect(url).toContain('https://testproj.apicdn.sanity.io/');
        expect(url).toContain(encodeURIComponent('"2026-06-12"'));
    });

    test('returns null on non-200', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.resolve(new Response('nope', { status: 500 })));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });

    test('returns null when fetch rejects (timeout/abort)', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.reject(new DOMException('aborted', 'TimeoutError')));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });

    test('returns null on unexpected response shape', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.resolve(new Response(JSON.stringify({ result: { custom: 'x' } }))));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });

    test('returns null on invalid JSON', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.resolve(new Response('<html>')));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });
});
