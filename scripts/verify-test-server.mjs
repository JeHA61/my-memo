import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectCurrentVersion } from './release-sync-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const host = '127.0.0.1';
const port = 4315;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function safePathFromUrl(urlString) {
  const url = new URL(urlString, `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname || '/');
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const absolute = path.resolve(projectRoot, relative);
  if (!absolute.startsWith(projectRoot)) return null;
  return absolute;
}

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const filePath = safePathFromUrl(req.url || '/');
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const body = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
      res.end(body);
    } catch (_error) {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

async function assertText(url, predicate, failureMessage) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const text = await response.text();
  if (!predicate(text)) throw new Error(failureMessage);
}

async function main() {
  const indexHtml = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  const version = detectCurrentVersion(indexHtml);
  const cacheBust = Date.now();

  const server = await startServer();
  try {
    await assertText(
      `http://${host}:${port}/index.html?v=${version}&b=${cacheBust}`,
      (text) => text.includes(`manifest.webmanifest?v=${version}`) && text.includes('src="./src/main.js"'),
      'index.html did not include expected runtime markers'
    );
    await assertText(
      `http://${host}:${port}/src/legacy/legacy-source.html?v=${version}&b=${cacheBust}`,
      (text) => text.includes(`register('./sw.js?v=${version}'`) && text.includes('.sync-main-btn.sync-gear-btn'),
      'legacy source did not include expected sync/runtime markers'
    );
    await assertText(
      `http://${host}:${port}/sw.js?v=${version}&b=${cacheBust}`,
      (text) => text.includes(`black-space-os-v${version}`),
      'service worker version marker mismatch'
    );
    await assertText(
      `http://${host}:${port}/manifest.webmanifest?v=${version}&b=${cacheBust}`,
      (text) => text.includes(`./index.html?v=${version}`),
      'manifest start_url version mismatch'
    );

    console.log(`[verify-test-server] OK on http://${host}:${port} (v${version})`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error('[verify-test-server] failed:', error);
  process.exitCode = 1;
});
