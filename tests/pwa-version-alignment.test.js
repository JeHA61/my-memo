import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function extractVersionFromIndex(html) {
  const matched = html.match(/manifest\.webmanifest\?v=(\d+)/);
  return matched ? matched[1] : null;
}

function extractStartUrlVersion(manifestText) {
  const manifest = JSON.parse(manifestText);
  const matched = String(manifest.start_url || '').match(/v=(\d+)/);
  return matched ? matched[1] : null;
}

function extractCacheVersion(swText) {
  const matched = swText.match(/CACHE_NAME\s*=\s*['"]black-space-os-v(\d+)['"]/);
  return matched ? matched[1] : null;
}

describe('pwa cache/version alignment', () => {
  test('루트 manifest/sw 버전은 index.html의 배포 버전과 일치해야 한다', () => {
    const indexHtml = readFileSync('index.html', 'utf8');
    const rootManifest = readFileSync('manifest.webmanifest', 'utf8');
    const rootSw = readFileSync('sw.js', 'utf8');

    const deployedVersion = extractVersionFromIndex(indexHtml);
    const manifestVersion = extractStartUrlVersion(rootManifest);
    const swVersion = extractCacheVersion(rootSw);

    expect(deployedVersion).toBeTruthy();
    expect(manifestVersion).toBe(deployedVersion);
    expect(swVersion).toBe(deployedVersion);
  });
});
