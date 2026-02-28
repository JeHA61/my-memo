import * as React from 'react';
import { useEffect, useRef } from 'react';
import '../../sync.js';
import { mountLegacyApp } from '../legacy/loader.js';

export default function LegacyApp() {
  const hostRef = useRef(null);

  useEffect(() => {
    let teardown = null;
    let cancelled = false;

    (async () => {
      if (!hostRef.current) return;
      const response = await fetch('./src/legacy/legacy-source.html', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load legacy source: ${response.status}`);
      const legacySourceHtml = await response.text();
      const cleanup = await mountLegacyApp({
        hostElement: hostRef.current,
        htmlText: legacySourceHtml
      });
      if (cancelled) {
        cleanup();
        return;
      }
      teardown = cleanup;
    })();

    return () => {
      cancelled = true;
      if (typeof teardown === 'function') teardown();
    };
  }, []);

  return React.createElement('div', { ref: hostRef, id: 'legacy-app-root' });
}
