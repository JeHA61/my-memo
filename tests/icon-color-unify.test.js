import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('icon color unification', () => {
  test('핵심 아이콘 버튼 배경은 검은색이고 크기는 + 버튼(26px)과 같아야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');

    expect(legacy).toMatch(/\.sync-main-btn\.sync-gear-btn\s*\{[\s\S]*?width:\s*26px;[\s\S]*?height:\s*26px;[\s\S]*?background:\s*#000;/);
    expect(legacy).toMatch(/\.todo-main-btn\s*\{[\s\S]*?width:\s*26px;[\s\S]*?height:\s*26px;[\s\S]*?background:\s*#000;/);
    expect(legacy).toMatch(/body\.app-mode\s+\.app-panel-toggle\s*\{[\s\S]*?width:\s*26px;[\s\S]*?height:\s*26px;[\s\S]*?background:\s*#000;/);
    expect(legacy).toMatch(/\.clip-btn\s*\{[\s\S]*?width:\s*26px;[\s\S]*?height:\s*26px;[\s\S]*?background:\s*#000;/);
  });
});
