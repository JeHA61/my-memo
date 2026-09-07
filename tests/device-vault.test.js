import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const deviceVaultApi = require('../device-vault.js');
const { createDeviceVault } = deviceVaultApi;

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Array.from(values.values()).join('\n');
    },
    replaceStoredValue(value) {
      const [key] = values.keys();
      values.set(key, value);
    }
  };
}

function createMemoryKeyStore() {
  let key = null;

  return {
    async get() {
      return key;
    },
    async set(nextKey) {
      key = nextKey;
    },
    async clear() {
      key = null;
    },
    peek() {
      return key;
    }
  };
}

function createTestVault(storage, keyStore) {
  return createDeviceVault({ crypto: webcrypto, storage, keyStore });
}

describe('device credential vault', () => {
  test('exports the browser vault API', () => {
    expect(deviceVaultApi).toMatchObject({
      createDeviceVault: expect.any(Function),
      openBrowserKeyStore: expect.any(Function),
      save: expect.any(Function),
      load: expect.any(Function),
      clear: expect.any(Function)
    });
    expect(window.BlackSpaceDeviceVault).toBe(deviceVaultApi);
  });

  test('stores only encrypted credential text with a non-exportable AES-256 key', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemoryKeyStore();
    const vault = createTestVault(storage, keyStore);

    await vault.save({ token: 'secret-token', passphrase: 'secret-key' });

    const storedText = storage.dump();
    expect(storedText).not.toContain('secret-token');
    expect(storedText).not.toContain('secret-key');
    expect(Object.keys(JSON.parse(storedText)).sort()).toEqual(['ciphertext', 'iv', 'version']);
    expect(keyStore.peek()).toMatchObject({
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: false
    });
    await expect(webcrypto.subtle.exportKey('raw', keyStore.peek())).rejects.toThrow();
  });

  test('uses a fresh IV for every write', async () => {
    const storage = createMemoryStorage();
    const vault = createTestVault(storage, createMemoryKeyStore());
    const credentials = { token: 'secret-token', passphrase: 'secret-key' };

    await vault.save(credentials);
    const firstPayload = JSON.parse(storage.dump());
    await vault.save(credentials);
    const secondPayload = JSON.parse(storage.dump());

    expect(secondPayload.iv).not.toBe(firstPayload.iv);
    expect(secondPayload.ciphertext).not.toBe(firstPayload.ciphertext);
  });

  test('restores credentials from a prior app session', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemoryKeyStore();
    const credentials = { token: 'session-token', passphrase: 'data-passphrase' };

    await createTestVault(storage, keyStore).save(credentials);
    const restored = await createTestVault(storage, keyStore).load();

    expect(restored).toEqual(credentials);
  });

  test('clear removes the persisted credentials and device key', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemoryKeyStore();
    const vault = createTestVault(storage, keyStore);

    await vault.save({ token: 'secret-token', passphrase: 'secret-key' });
    await vault.clear();

    expect(storage.dump()).toBe('');
    expect(keyStore.peek()).toBeNull();
    expect(await vault.load()).toBeNull();
  });

  test('rejects malformed persisted credential data explicitly', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemoryKeyStore();
    const vault = createTestVault(storage, keyStore);

    await vault.save({ token: 'secret-token', passphrase: 'secret-key' });
    storage.replaceStoredValue('{not-json');

    await expect(vault.load()).rejects.toThrow(/credential vault data is corrupt/i);
  });
});
