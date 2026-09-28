import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '../sync.js';
import { mountLegacyApp } from '../src/legacy/loader.js';

const STORAGE_KEY = 'BLACK_SPACE_OS_V2';
const BUILD_KEY = 'BLACK_SPACE_APP_BUILD';
const BUILD = '2026-02-28-v42';

describe('immediate memo persistence', () => {
  let host;
  let teardown;

  beforeEach(async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(BUILD_KEY, BUILD);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        folders: ['General'],
        memos: [
          {
            id: 'memo-1',
            folder: 'General',
            title: 'before',
            content: 'old content',
            date: '2026-09-28T00:00:00.000Z',
            updatedAt: '2026-09-28T00:00:00.000Z',
            deletedAt: null,
            image: null
          }
        ],
        memoTombstones: {},
        todos: [],
        todoTombstones: {},
        lastSyncedAt: null
      })
    );

    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    host = document.createElement('div');
    document.body.appendChild(host);
    const html = readFileSync('src/legacy/legacy-source.html', 'utf8');
    teardown = await mountLegacyApp({ hostElement: host, htmlText: html });
    window.selectMemo('memo-1');
  });

  afterEach(() => {
    if (typeof teardown === 'function') teardown();
    host?.remove();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('input 이벤트 직후 debounce 타이머 실행 전에도 작성 내용이 localStorage에 남는다', () => {
    const titleInput = document.getElementById('title-input');
    const contentInput = document.getElementById('content-input');

    titleInput.value = '2026.09.28';
    contentInput.value = 'closing immediately must not lose this';
    contentInput.dispatchEvent(new Event('input', { bubbles: true }));

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const memo = persisted.memos.find((item) => item.id === 'memo-1');

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(memo.title).toBe('2026.09.28');
    expect(memo.content).toBe('closing immediately must not lose this');
    expect(Date.parse(memo.updatedAt)).toBeGreaterThan(Date.parse('2026-09-28T00:00:00.000Z'));
  });
});
