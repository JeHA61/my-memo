import { describe, expect, test, vi } from 'vitest';
import { extractLegacyParts, mountLegacyApp } from '../src/legacy/loader.js';

const SAMPLE_HTML = `
<!doctype html>
<html>
<head>
  <style>.app-container { display: flex; }</style>
</head>
<body>
  <div id="app">hello</div>
  <script src="./external.js"></script>
  <script>
    window.onload = () => {
      window.__legacyStarted = true;
    };
    window.someLegacyFn = () => 'ok';
  </script>
</body>
</html>
`;

describe('extractLegacyParts', () => {
  test('style/body/script를 정확히 분리한다', () => {
    const parts = extractLegacyParts(SAMPLE_HTML);

    expect(parts.styleText).toContain('.app-container');
    expect(parts.bodyMarkup).toContain('id="app"');
    expect(parts.scriptText).toContain('window.onload');
  });

  test('외부 script 태그를 제외하고 마지막 인라인 script만 추출한다', () => {
    const parts = extractLegacyParts(SAMPLE_HTML);

    expect(parts.scriptText).not.toContain('<script');
    expect(parts.scriptText).toContain('window.someLegacyFn');
    expect(parts.bodyMarkup).not.toContain('<script');
  });
});

describe('mountLegacyApp', () => {
  test('마크업을 주입하고 script+onload를 실행한다', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const onloadSpy = vi.spyOn(window, 'onload', 'set');
    const teardown = await mountLegacyApp({ hostElement: host, htmlText: SAMPLE_HTML });

    expect(host.querySelector('#app')).not.toBeNull();
    expect(window.someLegacyFn()).toBe('ok');
    expect(window.__legacyStarted).toBe(true);
    expect(onloadSpy).toHaveBeenCalled();

    teardown();
    document.body.removeChild(host);
    onloadSpy.mockRestore();
    delete window.__legacyStarted;
    delete window.someLegacyFn;
  });
});
