# Unified Sync Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve all laptop and phone notes, separate local autosave from cloud synchronization, and replace SET/PULL/PUSH with one-tap bidirectional sync plus long-press recovery settings.

**Architecture:** Keep `sync.js` as the deterministic database merge and GitHub Contents API layer. Add a browser device-vault module that stores a non-exportable AES key in IndexedDB and only encrypted credentials in localStorage, then integrate it into the legacy runtime. Recovery exports an encrypted local snapshot, imports and merges another device snapshot, and explicitly re-encrypts the merged database with a new key while preserving the old remote file in Git history.

**Tech Stack:** React 18 wrapper, Vite 5, browser Web Crypto API, IndexedDB, GitHub Contents API, Vitest/JSDOM, Node test runner.

---

### Task 1: Device credential vault

**Files:**
- Create: `device-vault.js`
- Create: `tests/device-vault.test.js`
- Modify: `src/components/LegacyApp.js`
- Modify: `index.html`

**Step 1: Write the failing tests**

Test these behaviors with an in-memory key-store adapter:

```js
test('stores only encrypted credential text in persistent storage', async () => {
  const vault = createDeviceVault({ crypto, keyStore, storage });
  await vault.save({ token: 'secret-token', passphrase: 'secret-key' });
  expect(storage.dump()).not.toContain('secret-token');
  expect(storage.dump()).not.toContain('secret-key');
});

test('restores credentials after a new app session', async () => {
  await firstVault.save(credentials);
  expect(await secondVault.load()).toEqual(credentials);
});
```

**Step 2: Run tests to verify RED**

Run: `npm run test:unit -- tests/device-vault.test.js`

Expected: FAIL because `device-vault.js` does not exist.

**Step 3: Implement the minimal vault**

Expose `window.BlackSpaceDeviceVault` with:

```js
createDeviceVault(options)
openBrowserKeyStore()
save(credentials)
load()
clear()
```

Use AES-GCM with a fresh IV per write. Generate a non-exportable 256-bit AES key and persist the `CryptoKey` through IndexedDB structured cloning. Store only `{ version, iv, ciphertext }` in localStorage.

**Step 4: Load the vault before the legacy app**

Import `device-vault.js` in `LegacyApp.js`, and add the same script to the non-module fallback in `index.html`.

**Step 5: Run tests and commit**

Run: `npm run test:unit -- tests/device-vault.test.js tests/legacy-loader.test.js tests/pages-fallback.test.js`

Expected: PASS.

Commit:

```bash
git add device-vault.js src/components/LegacyApp.js index.html tests/device-vault.test.js
git commit -m "feat: persist encrypted sync credentials per device"
```

### Task 2: Encrypted backup export and merge import

**Files:**
- Create: `tests/recovery-backup.test.js`
- Modify: `src/legacy/legacy-source.html`

**Step 1: Write failing backup tests**

Cover:

```js
test('backup export encrypts the full normalized DB');
test('backup import rejects an incorrect password without changing local DB');
test('backup import merges distinct laptop and phone memos');
test('backup import keeps the newer edit and tombstones');
```

**Step 2: Run tests to verify RED**

Run: `npm run test:unit -- tests/recovery-backup.test.js`

Expected: FAIL because backup functions are missing.

**Step 3: Implement backup helpers**

Add:

```js
async function exportRecoveryBackup()
async function importRecoveryBackup(event)
async function parseRecoveryBackup(file, passphrase)
```

The export must call `flushAutoSave()`, normalize `db`, encrypt `{ schemaVersion, exportedAt, db }`, and download a `.blackspace-backup` file. Import must decrypt into a temporary value, validate it, merge with `Sync.mergeDb`, then persist and render only after successful validation.

**Step 4: Add hidden file input and advanced actions**

Add `BACKUP` and `IMPORT` inside the existing sync panel. Reuse existing button classes so dimensions, colors, and layout remain unchanged.

**Step 5: Run tests and commit**

Run: `npm run test:unit -- tests/recovery-backup.test.js tests/interaction-bindings.test.js`

Expected: PASS.

Commit:

```bash
git add src/legacy/legacy-source.html tests/recovery-backup.test.js
git commit -m "feat: add encrypted cross-device recovery backups"
```

### Task 3: One-tap sync and long-press settings

**Files:**
- Create: `tests/unified-sync-controls.test.js`
- Modify: `src/legacy/legacy-source.html`

**Step 1: Write failing interaction tests**

Cover:

```js
test('short gear activation calls syncWithGitHub once');
test('long press opens settings without starting sync');
test('context menu opens settings on desktop');
test('SET PULL and PUSH are not visible as normal actions');
```

**Step 2: Run tests to verify RED**

Run: `npm run test:unit -- tests/unified-sync-controls.test.js`

Expected: FAIL because the gear still opens the old four-button panel.

**Step 3: Implement unified controls**

Bind the gear button so:

```js
short click -> syncWithGitHub({ silent: false })
long press -> toggleSyncPanel(event)
right click -> toggleSyncPanel(event)
```

The long-press panel contains only `BACKUP`, `IMPORT`, `RECONNECT`, and diagnostic status. Keep keyboard sync (`Ctrl/Cmd+Shift+Y`) and remove normal SET/PULL/PUSH exposure.

**Step 4: Add clear sync status**

Show `SYNCING`, `SYNCED`, `OFFLINE`, or `RECONNECT` using the existing monochrome visual language without moving or resizing the gear icon.

**Step 5: Run tests and commit**

Run: `npm run test:unit -- tests/unified-sync-controls.test.js tests/interaction-bindings.test.js tests/icon-color-unify.test.js`

Expected: PASS.

Commit:

```bash
git add src/legacy/legacy-source.html tests/unified-sync-controls.test.js
git commit -m "feat: unify cloud sync behind the gear button"
```

### Task 4: Credential recovery and remote re-encryption

**Files:**
- Create: `tests/sync-reconnect.test.js`
- Modify: `src/legacy/legacy-source.html`
- Modify: `device-vault.js`

**Step 1: Write failing recovery tests**

Cover:

```js
test('reconnect validates the new PAT before changing saved credentials');
test('reconnect obtains the existing remote SHA without decrypting old content');
test('reconnect writes the current merged DB with a new encryption key');
test('failed remote write leaves the local DB and prior vault intact');
test('successful reconnect replaces the old vault and enables auto sync');
```

**Step 2: Run tests to verify RED**

Run: `npm run test:unit -- tests/sync-reconnect.test.js`

Expected: FAIL because reconnect migration is missing.

**Step 3: Implement transactional reconnect**

Add `reconnectGitHubSync()`:

1. Flush local autosave.
2. Require an explicit confirmation that both device backups were merged.
3. Prompt for owner, repository, branch, path, new fine-grained PAT, and new data key twice.
4. Read the remote file metadata with the new PAT to validate access and capture SHA.
5. Encrypt a copy of the current normalized DB with a new salt and data key.
6. PUT it using the existing SHA and a recovery commit message.
7. Only after PUT succeeds, replace local security config and device vault credentials.

**Step 4: Restore credentials at startup**

Attempt `BlackSpaceDeviceVault.load()` during startup. On success, place the PAT in session storage, restore the data key in memory, and run the existing startup sync. On failure, keep local editing available and show `RECONNECT` without repeated prompts.

**Step 5: Run tests and commit**

Run: `npm run test:unit -- tests/sync-reconnect.test.js tests/device-vault.test.js tests/autosave-reliability.test.js`

Expected: PASS.

Commit:

```bash
git add device-vault.js src/legacy/legacy-source.html tests/sync-reconnect.test.js
git commit -m "feat: recover sync with new encrypted credentials"
```

### Task 5: Full verification, release version, and deployment

**Files:**
- Modify: release-managed version files via `npm run release:sync`
- Verify: `.github/workflows/deploy-pages.yml`
- Update: `/Users/jang/Applications/BLACK SPACE Dock.app/Contents/Resources/Scripts/main.scpt` if its cache-busting URL has regressed

**Step 1: Run the full suite before release**

Run: `npm test`

Expected: all Vitest and Node sync tests PASS.

**Step 2: Build and verify locally**

Run:

```bash
npm run build
npm run verify:server
```

Expected: Vite build succeeds and the local server reports the current release version.

**Step 3: Bump all PWA release markers**

Run: `npm run release:auto`

Expected: version markers in index, manifest, service workers, legacy source, and tests are synchronized; all verification passes again.

**Step 4: Commit and push**

```bash
git add index.html manifest.webmanifest public/manifest.webmanifest public/sw.js src/legacy/legacy-source.html sw.js tests/legacy-app-react.test.jsx
git commit -m "release: deploy unified sync recovery"
git push origin main
```

**Step 5: Verify GitHub Pages**

Confirm the public URL serves the new manifest version and that desktop and mobile layouts load without console errors.

**Step 6: Update and launch Dock app**

Keep the cache-busting desktop URL:

```text
https://jeha61.github.io/my-memo/index.html?layout=desktop&b=<timestamp>
```

Launch the Dock app and verify the three-column desktop layout and one-tap gear sync.

**Step 7: Perform the user recovery handoff**

1. Export an encrypted backup from the phone.
2. Import it on the laptop and verify memo/folder/TODO counts.
3. Export the merged laptop backup.
4. Create a new fine-grained PAT scoped to repository `JeHA61/memo` with Contents read/write.
5. Run `RECONNECT` on the laptop and confirm the recovery commit exists.
6. Run `RECONNECT` on the phone using the same PAT and data key.
7. Edit one test memo on each device and verify one-tap sync converges without losing either edit.

