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

  test('내부 아이콘 글리프 크기도 동일 비율(14px)이어야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');

    expect(legacy).toMatch(/\.btn-add-folder\s*\{[\s\S]*?font-size:\s*14px;/);
    expect(legacy).toMatch(/\.btn-add-memo\s*\{[\s\S]*?font-size:\s*14px;/);
    expect(legacy).toMatch(/\.sync-gear-icon\s*\{[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;/);
    expect(legacy).toMatch(/\.todo-main-icon\s*\{[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;/);
    expect(legacy).toMatch(/\.clip-icon\s*\{[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;/);
    expect(legacy).toMatch(/body\.app-mode\s+\.app-panel-toggle\s*\{[\s\S]*?font-size:\s*14px;/);
    expect(legacy).toContain('class="clip-icon"');
  });
});
