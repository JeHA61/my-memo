import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('icon color unification', () => {
  test('핵심 아이콘 버튼(톱니/TODO/앱패널)은 검은색 아이콘을 사용해야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');

    expect(legacy).toMatch(/\.sync-main-btn\.sync-gear-btn\s*\{[\s\S]*?color:\s*#000;/);
    expect(legacy).toMatch(/\.todo-main-btn\s*\{[\s\S]*?color:\s*#000;/);
    expect(legacy).toMatch(/body\.app-mode\s+\.app-panel-toggle\s*\{[\s\S]*?color:\s*#000;/);
  });
});
