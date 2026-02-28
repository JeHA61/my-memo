import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import LegacyApp from '../src/components/LegacyApp.jsx';

beforeEach(() => {
  window.localStorage.setItem('BLACK_SPACE_APP_BUILD', '2026-02-28-v30');
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
});
