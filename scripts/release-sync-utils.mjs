function replaceRegex(text, regex, replacer) {
  return String(text).replace(regex, replacer);
}

export function detectCurrentVersion(indexHtml) {
  const matched = String(indexHtml).match(/manifest\.webmanifest\?v=(\d+)/);
  if (!matched) {
    throw new Error('Failed to detect current version from index.html');
  }
  return Number.parseInt(matched[1], 10);
}

function assertValidVersion(version) {
  if (!Number.isInteger(version) || version <= 0) {
    throw new Error(`Invalid version: ${version}`);
  }
}

function assertValidDate(buildDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(buildDate))) {
    throw new Error(`Invalid build date: ${buildDate}`);
  }
}

export function applyReleaseVersion(source, options) {
  const version = Number(options?.version);
  const buildDate = String(options?.buildDate || '');
  assertValidVersion(version);
  assertValidDate(buildDate);

  const vToken = String(version);
  const buildToken = `${buildDate}-v${vToken}`;

  return {
    indexHtml: replaceRegex(source.indexHtml, /([?&]v=)\d+/g, `$1${vToken}`),
    legacyHtml: replaceRegex(
      replaceRegex(
        replaceRegex(
          replaceRegex(source.legacyHtml, /([?&]v=)\d+/g, `$1${vToken}`),
          /(APP_BUILD\s*=\s*')[^']+(';)/,
          `$1${buildToken}$2`
        ),
        /(searchParams\.set\('v',\s*')\d+('\))/,
        `$1${vToken}$2`
      ),
      /(register\('\.\/sw\.js\?v=)\d+('\))/,
      `$1${vToken}$2`
    ),
    rootManifest: replaceRegex(
      source.rootManifest,
      /("start_url"\s*:\s*"\.\/index\.html\?v=)\d+(")/,
      `$1${vToken}$2`
    ),
    publicManifest: replaceRegex(
      source.publicManifest,
      /("start_url"\s*:\s*"\.\/index\.html\?v=)\d+(")/,
      `$1${vToken}$2`
    ),
    rootSw: replaceRegex(source.rootSw, /(CACHE_NAME\s*=\s*'black-space-os-v)\d+(')/, `$1${vToken}$2`),
    publicSw: replaceRegex(source.publicSw, /(CACHE_NAME\s*=\s*'black-space-os-v)\d+(')/, `$1${vToken}$2`),
    legacyTest: replaceRegex(
      source.legacyTest,
      /(BLACK_SPACE_APP_BUILD',\s*')[^']+(')/,
      `$1${buildToken}$2`
    )
  };
}
