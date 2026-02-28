import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import LegacyApp from '../src/components/LegacyApp.js';

beforeEach(() => {
  window.localStorage.setItem('BLACK_SPACE_APP_BUILD', '2026-02-28-v36');
  const html = `
  <!doctype html>
  <html>
    <head><style>.x{}</style></head>
    <body>
      <div id="folder-sidebar"></div>
      <div id="memo-list-bar"></div>
      <div id="sync-fab"></div>
      <div id="todo-fab"></div>
      <script>
        window.onload = () => {};
        window.toggleTodoPanel = () => {};
        window.toggleSyncPanel = () => {};
      </script>
    </body>
  </html>
  `;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      text: async () => html
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LegacyApp(React 래퍼)', () => {
  test('기존 레이아웃 DOM을 렌더링한다', async () => {
    const { container } = render(<LegacyApp />);

    await waitFor(() => {
      expect(container.querySelector('#folder-sidebar')).not.toBeNull();
      expect(container.querySelector('#memo-list-bar')).not.toBeNull();
      expect(container.querySelector('#sync-fab')).not.toBeNull();
      expect(container.querySelector('#todo-fab')).not.toBeNull();
    });
  });

  test('기존 전역 핸들러를 노출한다', async () => {
    render(<LegacyApp />);

    await waitFor(() => {
      expect(typeof window.toggleTodoPanel).toBe('function');
      expect(typeof window.toggleSyncPanel).toBe('function');
    });
  });

  test('원본 레거시 html 파일을 fetch로 읽어온다', async () => {
    render(<LegacyApp />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('./src/legacy/legacy-source.html', { cache: 'no-store' });
    });
  });
});
