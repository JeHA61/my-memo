import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('todo main button icon', () => {
  test('TODO 텍스트 대신 2D SVG 아이콘을 사용해야 한다', () => {
    const legacy = readFileSync('src/legacy/legacy-source.html', 'utf8');
    expect(legacy).toContain('class="todo-main-icon"');
    expect(legacy).toContain('<svg class="todo-main-icon"');
    expect(legacy).not.toContain('>TODO</button>');
  });
});
