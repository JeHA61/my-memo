import { useEffect, useRef } from 'react';
import '../../sync.js';
import legacySourceHtml from '../legacy/legacy-source.html?raw';
import { mountLegacyApp } from '../legacy/loader.js';

export default function LegacyApp() {
  const hostRef = useRef(null);

  useEffect(() => {
    let teardown = null;
    let cancelled = false;

    (async () => {
      if (!hostRef.current) return;
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

  return <div ref={hostRef} id="legacy-app-root" />;
}
