import { describe, expect, test } from 'vitest';
import { applyReleaseVersion, detectCurrentVersion } from '../scripts/release-sync-utils.mjs';

describe('release sync utils', () => {
  test('index.html에서 현재 버전을 감지한다', () => {
    const indexHtml = '<link rel="manifest" href="./manifest.webmanifest?v=40" />';
    expect(detectCurrentVersion(indexHtml)).toBe(40);
  });

  test('관련 파일 문자열을 새 버전으로 일괄 갱신한다', () => {
    const source = {
      indexHtml:
        '<link rel="manifest" href="./manifest.webmanifest?v=40"><script>const x="./sync.js?v=40";</script>',
      legacyHtml:
        "const APP_BUILD = '2026-02-28-v40'; nextUrl.searchParams.set('v', '40'); navigator.serviceWorker.register('./sw.js?v=40');",
      rootManifest: '{"start_url":"./index.html?v=40"}',
      publicManifest: '{"start_url":"./index.html?v=40"}',
      rootSw: "const CACHE_NAME = 'black-space-os-v40';",
      publicSw: "const CACHE_NAME = 'black-space-os-v40';",
      legacyTest: "window.localStorage.setItem('BLACK_SPACE_APP_BUILD', '2026-02-28-v40');"
    };

    const updated = applyReleaseVersion(source, { version: 41, buildDate: '2026-03-01' });

    expect(updated.indexHtml).toContain('manifest.webmanifest?v=41');
    expect(updated.indexHtml).toContain('sync.js?v=41');
    expect(updated.legacyHtml).toContain("APP_BUILD = '2026-03-01-v41'");
    expect(updated.legacyHtml).toContain("searchParams.set('v', '41')");
    expect(updated.legacyHtml).toContain("sw.js?v=41");
    expect(updated.rootManifest).toContain('./index.html?v=41');
    expect(updated.publicManifest).toContain('./index.html?v=41');
    expect(updated.rootSw).toContain("black-space-os-v41");
    expect(updated.publicSw).toContain("black-space-os-v41");
    expect(updated.legacyTest).toContain("BLACK_SPACE_APP_BUILD', '2026-03-01-v41");
  });
});
