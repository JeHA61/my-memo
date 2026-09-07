(function (globalScope, factory) {
    const api = factory(globalScope);

    globalScope.BlackSpaceDeviceVault = api;
    if (globalScope.window && globalScope.window !== globalScope) {
        globalScope.window.BlackSpaceDeviceVault = api;
    }

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (globalScope) {
    const STORAGE_KEY = 'BLACK_SPACE_DEVICE_CREDENTIALS';
    const DATABASE_NAME = 'BLACK_SPACE_DEVICE_VAULT';
    const OBJECT_STORE_NAME = 'keys';
    const DEVICE_KEY_ID = 'credential-key';
    const FORMAT_VERSION = 1;
    const IV_LENGTH = 12;

    function createError(message, cause) {
        const error = new Error(message);
        if (cause) error.cause = cause;
        return error;
    }

    function getCrypto(cryptoApi) {
        const resolved = cryptoApi || globalScope.crypto;
        if (!resolved || !resolved.subtle || typeof resolved.getRandomValues !== 'function') {
            throw createError('Device credential vault requires the Web Crypto API.');
        }
        return resolved;
    }

    function getStorage(storage) {
        let resolved = storage;
        try {
            resolved = resolved || globalScope.localStorage;
        } catch (cause) {
            throw createError('Device credential storage is unavailable.', cause);
        }

        if (!resolved || typeof resolved.getItem !== 'function' || typeof resolved.setItem !== 'function' || typeof resolved.removeItem !== 'function') {
            throw createError('Device credential storage is unavailable.');
        }
        return resolved;
    }

    function validateCredentials(credentials) {
        if (
            !credentials ||
            typeof credentials !== 'object' ||
            Array.isArray(credentials) ||
            typeof credentials.token !== 'string' ||
            typeof credentials.passphrase !== 'string'
        ) {
            throw createError('Device credentials must include a token and passphrase.');
        }
        return credentials;
    }

    function bytesToBase64(bytes) {
        if (typeof globalScope.btoa !== 'function') {
            throw createError('Device credential vault requires base64 support.');
        }

        let binary = '';
        for (let index = 0; index < bytes.length; index += 1) {
            binary += String.fromCharCode(bytes[index]);
        }
        return globalScope.btoa(binary);
    }

    function base64ToBytes(value) {
        if (typeof value !== 'string' || !value || typeof globalScope.atob !== 'function') {
            throw createError('Device credential vault data is corrupt.');
        }

        try {
            const binary = globalScope.atob(value);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            return bytes;
        } catch (cause) {
            throw createError('Device credential vault data is corrupt.', cause);
        }
    }

    function parseEnvelope(storedText) {
        let envelope;
        try {
            envelope = JSON.parse(storedText);
        } catch (cause) {
            throw createError('Device credential vault data is corrupt.', cause);
        }

        if (
            !envelope ||
            typeof envelope !== 'object' ||
            Array.isArray(envelope) ||
            envelope.version !== FORMAT_VERSION ||
            typeof envelope.iv !== 'string' ||
            typeof envelope.ciphertext !== 'string'
        ) {
            throw createError('Device credential vault data is corrupt.');
        }
        return envelope;
    }

    function openBrowserKeyStore() {
        return new Promise((resolve, reject) => {
            const indexedDb = globalScope.indexedDB;
            if (!indexedDb || typeof indexedDb.open !== 'function') {
                reject(createError('Device credential key store is unavailable because IndexedDB is not supported.'));
                return;
            }

            let openRequest;
            try {
                openRequest = indexedDb.open(DATABASE_NAME, 1);
            } catch (cause) {
                reject(createError('Device credential key store could not be opened.', cause));
                return;
            }

            openRequest.onupgradeneeded = () => {
                const database = openRequest.result;
                if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                    database.createObjectStore(OBJECT_STORE_NAME);
                }
            };
            openRequest.onerror = () => {
                reject(createError('Device credential key store could not be opened.', openRequest.error));
            };
            openRequest.onblocked = () => {
                reject(createError('Device credential key store opening was blocked.'));
            };
            openRequest.onsuccess = () => {
                const database = openRequest.result;
                database.onversionchange = () => database.close();

                function runTransaction(mode, operation, failureMessage) {
                    return new Promise((resolveOperation, rejectOperation) => {
                        let request;
                        let result;
                        let settled = false;

                        function fail(cause) {
                            if (settled) return;
                            settled = true;
                            rejectOperation(createError(failureMessage, cause));
                        }

                        try {
                            const transaction = database.transaction(OBJECT_STORE_NAME, mode);
                            transaction.oncomplete = () => {
                                if (settled) return;
                                settled = true;
                                resolveOperation(result);
                            };
                            transaction.onerror = () => fail(transaction.error);
                            transaction.onabort = () => fail(transaction.error);

                            request = operation(transaction.objectStore(OBJECT_STORE_NAME));
                            request.onsuccess = () => {
                                result = request.result;
                            };
                            request.onerror = () => fail(request.error);
                        } catch (cause) {
                            fail(cause);
                        }
                    });
                }

                resolve({
                    get() {
                        return runTransaction(
                            'readonly',
                            (store) => store.get(DEVICE_KEY_ID),
                            'Device credential key could not be read.'
                        );
                    },
                    set(key) {
                        return runTransaction(
                            'readwrite',
                            (store) => store.put(key, DEVICE_KEY_ID),
                            'Device credential key could not be stored.'
                        );
                    },
                    clear() {
                        return runTransaction(
                            'readwrite',
                            (store) => store.delete(DEVICE_KEY_ID),
                            'Device credential key could not be cleared.'
                        );
                    }
                });
            };
        });
    }

    function createDeviceVault(options) {
        const config = options || {};
        let browserKeyStorePromise = null;

        function resolveKeyStore() {
            if (config.keyStore) return Promise.resolve(config.keyStore);
            if (!browserKeyStorePromise) browserKeyStorePromise = openBrowserKeyStore();
            return browserKeyStorePromise;
        }

        async function getOrCreateKey(cryptoApi, keyStore) {
            let key;
            try {
                key = await keyStore.get();
            } catch (cause) {
                throw createError('Device credential key could not be read.', cause);
            }
            if (key) return key;

            key = await cryptoApi.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            try {
                await keyStore.set(key);
            } catch (cause) {
                throw createError('Device credential key could not be stored.', cause);
            }
            return key;
        }

        async function save(credentials) {
            const validatedCredentials = validateCredentials(credentials);
            const cryptoApi = getCrypto(config.crypto);
            const storage = getStorage(config.storage);
            const keyStore = await resolveKeyStore();
            const key = await getOrCreateKey(cryptoApi, keyStore);
            const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH));
            const plaintext = new TextEncoder().encode(JSON.stringify(validatedCredentials));
            const encrypted = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
            const envelope = {
                version: FORMAT_VERSION,
                iv: bytesToBase64(iv),
                ciphertext: bytesToBase64(new Uint8Array(encrypted)),
            };

            try {
                storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
            } catch (cause) {
                throw createError('Encrypted device credentials could not be stored.', cause);
            }
        }

        async function load() {
            const cryptoApi = getCrypto(config.crypto);
            const storage = getStorage(config.storage);
            let storedText;
            try {
                storedText = storage.getItem(STORAGE_KEY);
            } catch (cause) {
                throw createError('Encrypted device credentials could not be read.', cause);
            }
            if (storedText === null) return null;

            const envelope = parseEnvelope(storedText);
            const iv = base64ToBytes(envelope.iv);
            const ciphertext = base64ToBytes(envelope.ciphertext);
            if (iv.length !== IV_LENGTH || ciphertext.length === 0) {
                throw createError('Device credential vault data is corrupt.');
            }

            const keyStore = await resolveKeyStore();
            let key;
            try {
                key = await keyStore.get();
            } catch (cause) {
                throw createError('Device credential key could not be read.', cause);
            }
            if (!key) throw createError('Device credential key is missing.');

            let plaintext;
            try {
                plaintext = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            } catch (cause) {
                throw createError('Device credential vault data is corrupt.', cause);
            }

            try {
                return validateCredentials(JSON.parse(new TextDecoder().decode(plaintext)));
            } catch (cause) {
                throw createError('Device credential vault data is corrupt.', cause);
            }
        }

        async function clear() {
            const storage = getStorage(config.storage);
            try {
                storage.removeItem(STORAGE_KEY);
            } catch (cause) {
                throw createError('Encrypted device credentials could not be cleared.', cause);
            }

            const keyStore = await resolveKeyStore();
            try {
                await keyStore.clear();
            } catch (cause) {
                throw createError('Device credential key could not be cleared.', cause);
            }
        }

        return { save, load, clear };
    }

    const defaultVault = createDeviceVault();

    return {
        createDeviceVault,
        openBrowserKeyStore,
        save(credentials) {
            return defaultVault.save(credentials);
        },
        load() {
            return defaultVault.load();
        },
        clear() {
            return defaultVault.clear();
        },
    };
});
