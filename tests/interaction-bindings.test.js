import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('interaction bindings', () => {
  test('우클릭은 이벤트 위임(contextmenu) 바인딩이 있어야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');
    expect(legacy).toContain('function setupContextMenuBindings()');
    expect(legacy).toContain("folderList.addEventListener('contextmenu'");
    expect(legacy).toContain("memoList.addEventListener('contextmenu'");
  });

  test('롱프레스는 touch + pointer fallback 바인딩이 있어야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');
    expect(legacy).toMatch(/container\.addEventListener\(\s*'touchstart'/);
    expect(legacy).toContain("container.addEventListener('pointerdown'");
    expect(legacy).toContain("container.addEventListener('pointerup'");
  });

  test('인라인 핸들러 함수는 window 전역으로 노출되어야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');
    expect(legacy).toContain('window.showFolderCtx = showFolderCtx;');
    expect(legacy).toContain('window.showMemoCtx = showMemoCtx;');
    expect(legacy).toContain('window.selectFolder = selectFolder;');
    expect(legacy).toContain('window.selectMemo = selectMemo;');
    expect(legacy).toContain('window.addFolder = addFolder;');
    expect(legacy).toContain('window.addMemo = addMemo;');
  });
});
