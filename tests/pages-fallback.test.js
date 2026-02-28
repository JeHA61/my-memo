import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('pages runtime fallback', () => {
  test('index.html에는 모듈 부팅 실패 대비 레거시 fallback이 있어야 한다', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('window.__BLACKSPACE_LEGACY_FALLBACK__');
    expect(html).toContain("fetch('./src/legacy/legacy-source.html'");
  });
});
