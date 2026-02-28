import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('pages entry', () => {
  test('GitHub Pages 엔트리는 .js 모듈을 사용해야 한다', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('src="./src/main.js"');
    expect(html).not.toContain('src="./src/main.jsx"');
  });
});
