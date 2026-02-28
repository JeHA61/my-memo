import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReleaseVersion, detectCurrentVersion } from './release-sync-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const FILES = {
  indexHtml: path.join(projectRoot, 'index.html'),
  legacyHtml: path.join(projectRoot, 'src/legacy/legacy-source.html'),
  rootManifest: path.join(projectRoot, 'manifest.webmanifest'),
  publicManifest: path.join(projectRoot, 'public/manifest.webmanifest'),
  rootSw: path.join(projectRoot, 'sw.js'),
  publicSw: path.join(projectRoot, 'public/sw.js'),
  legacyTest: path.join(projectRoot, 'tests/legacy-app-react.test.jsx')
};

function parseArgs(argv) {
  let explicitVersion = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (token === '--version') {
      explicitVersion = Number(argv[i + 1]);
      i += 1;
    }
  }

  return { explicitVersion, dryRun };
}

async function readSources() {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, filePath]) => [key, await readFile(filePath, 'utf8')])
  );
  return Object.fromEntries(entries);
}

async function writeSources(contents) {
  await Promise.all(
    Object.entries(FILES).map(async ([key, filePath]) => {
      await writeFile(filePath, contents[key], 'utf8');
    })
  );
}

function getBuildDate() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const { explicitVersion, dryRun } = parseArgs(process.argv.slice(2));
  const source = await readSources();

  const currentVersion = detectCurrentVersion(source.indexHtml);
  const nextVersion = Number.isInteger(explicitVersion) ? explicitVersion : currentVersion + 1;

  if (!Number.isInteger(nextVersion) || nextVersion <= 0) {
    throw new Error(`Invalid target version: ${nextVersion}`);
  }

  const updated = applyReleaseVersion(source, {
    version: nextVersion,
    buildDate: getBuildDate()
  });

  if (!dryRun) {
    await writeSources(updated);
  }

  const mode = dryRun ? 'DRY RUN' : 'UPDATED';
  console.log(`[release-sync] ${mode}: v${currentVersion} -> v${nextVersion}`);
  console.log('[release-sync] Files:');
  Object.values(FILES).forEach((filePath) => {
    console.log(`- ${path.relative(projectRoot, filePath)}`);
  });
}

main().catch((error) => {
  console.error('[release-sync] failed:', error);
  process.exitCode = 1;
});
