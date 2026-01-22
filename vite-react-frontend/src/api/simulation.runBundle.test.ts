import { describe, expect, it, vi } from 'vitest';
import { exportRunBundle } from './simulation';

describe('exportRunBundle', () => {
  it('downloads the bundle with filename from content-disposition (or fallback)', async () => {
    const blob = new Blob([JSON.stringify({ ok: true })], { type: 'application/json' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(blob, {
        status: 200,
        headers: new Headers({
          'content-disposition': 'attachment; filename="bundle.json"',
        }),
      }) as any
    );

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;

    // jsdom may not implement these; polyfill for this test.
    (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:mock');
    (URL as any).revokeObjectURL = vi.fn().mockImplementation(() => {});

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportRunBundle('sim-123');

    expect(fetchSpy).toHaveBeenCalled();
    expect((URL as any).createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect((URL as any).revokeObjectURL).toHaveBeenCalled();

    fetchSpy.mockRestore();
    clickSpy.mockRestore();

    (URL as any).createObjectURL = originalCreateObjectURL;
    (URL as any).revokeObjectURL = originalRevokeObjectURL;
  });
});
