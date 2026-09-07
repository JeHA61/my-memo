import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('autosave reliability', () => {
  test('자동저장은 IME/모바일 종료 경로를 위한 보조 이벤트를 바인딩해야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');
    expect(legacy).toContain("titleInput.addEventListener('compositionend', scheduleAutoSave)");
    expect(legacy).toContain("contentInput.addEventListener('compositionend', scheduleAutoSave)");
    expect(legacy).toContain("titleInput.addEventListener('change', scheduleAutoSave)");
    expect(legacy).toContain("contentInput.addEventListener('change', scheduleAutoSave)");
    expect(legacy).toContain("window.addEventListener('pagehide', flushAutoSave)");
  });

  test('flushAutoSave는 타이머가 없어도 변경분이 있으면 저장할 수 있어야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');
    expect(legacy).toContain('let autoSaveDirty = false;');
    expect(legacy).toContain('if (!currentMemoId || (!autoSaveTimer && !autoSaveDirty)) return;');
    expect(legacy).toContain('autoSaveDirty = true;');
    expect(legacy).toContain('if (saved) autoSaveDirty = false;');
  });
});
