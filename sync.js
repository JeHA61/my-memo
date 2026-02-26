(function (globalScope, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    globalScope.BlackSpaceSync = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const CONFIG_KEY = 'BLACK_SPACE_GITHUB_CONFIG';
    const TOKEN_KEY = 'BLACK_SPACE_GITHUB_TOKEN';

    function nowIso() {
        return new Date().toISOString();
    }

    function toTs(value) {
        if (!value) return 0;
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? 0 : ts;
    }

    function toIsoOr(value, fallback) {
        const ts = toTs(value);
        if (!ts) return fallback;
        return new Date(ts).toISOString();
    }

    function maxIso(a, b) {
        if (!a) return b || null;
        if (!b) return a || null;
        return toTs(a) >= toTs(b) ? a : b;
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function normalizeTombstones(input) {
        const out = {};
        if (!input || typeof input !== 'object') return out;

        Object.keys(input).forEach((key) => {
            const normKey = String(key || '').trim();
            if (!normKey) return;
            const iso = toIsoOr(input[key], null);
            if (iso) out[normKey] = iso;
        });

        return out;
    }

    function normalizeDb(rawDb) {
        const base = rawDb && typeof rawDb === 'object' ? rawDb : {};
        const now = nowIso();

        const folderSet = new Set();
        if (Array.isArray(base.folders)) {
            base.folders.forEach((folder) => {
                const name = String(folder || '').trim();
                if (name) folderSet.add(name);
            });
        }

        const memoTombstones = normalizeTombstones(base.memoTombstones);

        const memos = Array.isArray(base.memos)
            ? base.memos.map((memo, index) => {
                  const source = memo && typeof memo === 'object' ? memo : {};
                  const id = source.id ? String(source.id) : 'legacy-' + String(index);
                  const folderRaw = String(source.folder || '').trim();
                  const folder = folderRaw || 'General';

                  folderSet.add(folder);

                  const date = toIsoOr(source.date, now);
                  const updatedAt = toIsoOr(source.updatedAt, date);
                  const deletedAt = toIsoOr(source.deletedAt, null);

                  return {
                      id,
                      folder,
                      title: String(source.title || ''),
                      content: String(source.content || ''),
                      date,
                      updatedAt,
                      deletedAt,
                      image: typeof source.image === 'string' ? source.image : null,
                  };
              })
            : [];

        memos.forEach((memo) => {
            const tombTs = memoTombstones[memo.id] || null;
            const combinedDeleted = maxIso(memo.deletedAt, tombTs);
            if (combinedDeleted) {
                memo.deletedAt = combinedDeleted;
                memo.updatedAt = maxIso(memo.updatedAt, combinedDeleted);
                memoTombstones[memo.id] = combinedDeleted;
            }
        });

        const folders = Array.from(folderSet);
        if (!folders.length) folders.push('General');

        memos.sort((a, b) => toTs(b.updatedAt) - toTs(a.updatedAt));

        return {
            folders,
            memos,
            memoTombstones,
            lastSyncedAt: toIsoOr(base.lastSyncedAt, null),
        };
    }

    function pickNewerMemo(a, b) {
        if (!a && !b) return null;
        if (!a) return clone(b);
        if (!b) return clone(a);
        return toTs(a.updatedAt) >= toTs(b.updatedAt) ? clone(a) : clone(b);
    }

    function mergeDb(localDb, remoteDb) {
        const local = normalizeDb(localDb);
        const remote = normalizeDb(remoteDb);

        const localById = new Map(local.memos.map((memo) => [memo.id, memo]));
        const remoteById = new Map(remote.memos.map((memo) => [memo.id, memo]));

        const idSet = new Set([
            ...localById.keys(),
            ...remoteById.keys(),
            ...Object.keys(local.memoTombstones),
            ...Object.keys(remote.memoTombstones),
        ]);

        const mergedMemos = [];
        const mergedTombstones = { ...local.memoTombstones };

        idSet.forEach((id) => {
            const localMemo = localById.get(id) || null;
            const remoteMemo = remoteById.get(id) || null;

            const memoDeleteTs = maxIso(localMemo && localMemo.deletedAt, remoteMemo && remoteMemo.deletedAt);
            const tombDeleteTs = maxIso(local.memoTombstones[id], remote.memoTombstones[id]);
            const finalDeleteTs = maxIso(memoDeleteTs, tombDeleteTs);

            const newerMemo = pickNewerMemo(localMemo, remoteMemo);

            if (finalDeleteTs) {
                mergedTombstones[id] = finalDeleteTs;
                if (newerMemo) {
                    newerMemo.deletedAt = finalDeleteTs;
                    newerMemo.updatedAt = maxIso(newerMemo.updatedAt, finalDeleteTs);
                    mergedMemos.push(newerMemo);
                }
                return;
            }

            if (!newerMemo) return;
            newerMemo.deletedAt = null;
            mergedMemos.push(newerMemo);
        });

        const folderSet = new Set([...local.folders, ...remote.folders]);
        mergedMemos.forEach((memo) => {
            if (!memo.deletedAt) folderSet.add(memo.folder);
        });

        const folders = Array.from(folderSet);
        if (!folders.length) folders.push('General');

        mergedMemos.sort((a, b) => toTs(b.updatedAt) - toTs(a.updatedAt));

        return {
            folders,
            memos: mergedMemos,
            memoTombstones: mergedTombstones,
            lastSyncedAt: maxIso(local.lastSyncedAt, remote.lastSyncedAt),
        };
    }

    function touchMemo(memo, iso) {
        const now = iso || nowIso();
        memo.date = now;
        memo.updatedAt = now;
        if (!memo.deletedAt) memo.deletedAt = null;
        return memo;
    }

    function markMemoDeleted(db, id, iso) {
        const now = iso || nowIso();
        if (!db.memoTombstones || typeof db.memoTombstones !== 'object') db.memoTombstones = {};
        db.memoTombstones[id] = maxIso(db.memoTombstones[id], now);

        const memo = Array.isArray(db.memos) ? db.memos.find((item) => item.id === id) : null;
        if (memo) {
            memo.deletedAt = maxIso(memo.deletedAt, now);
            memo.updatedAt = maxIso(memo.updatedAt || memo.date, now);
        }
        return db;
    }

    function getVisibleMemos(db, folder) {
        const source = Array.isArray(db.memos) ? db.memos : [];
        return source.filter((memo) => {
            if (memo.deletedAt) return false;
            if (!folder) return true;
            return memo.folder === folder;
        });
    }

    function encodeBase64Utf8(text) {
        if (typeof btoa === 'function') {
            return btoa(unescape(encodeURIComponent(text)));
        }
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(text, 'utf8').toString('base64');
        }
        throw new Error('No base64 encoder available in this environment.');
    }

    function decodeBase64Utf8(base64) {
        if (!base64) return '';
        if (typeof atob === 'function') {
            return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
        }
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(base64.replace(/\n/g, ''), 'base64').toString('utf8');
        }
        throw new Error('No base64 decoder available in this environment.');
    }

    function serializeRemotePayload(db) {
        return JSON.stringify(
            {
                schemaVersion: 2,
                savedAt: nowIso(),
                db: normalizeDb(db),
            },
            null,
            2
        );
    }

    function parseRemotePayload(text) {
        if (!text) return null;
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (_err) {
            return null;
        }

        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.db) return normalizeDb(parsed.db);
        if (parsed.folders || parsed.memos) return normalizeDb(parsed);
        return null;
    }

    function sanitizeConfig(config) {
        const source = config && typeof config === 'object' ? config : {};
        return {
            owner: String(source.owner || '').trim(),
            repo: String(source.repo || '').trim(),
            branch: String(source.branch || 'main').trim() || 'main',
            path: String(source.path || 'data/notes.json').trim() || 'data/notes.json',
            token: String(source.token || '').trim(),
        };
    }

    function validateGitHubConfig(config) {
        const cfg = sanitizeConfig(config);
        const missing = [];
        if (!cfg.owner) missing.push('owner');
        if (!cfg.repo) missing.push('repo');
        if (!cfg.branch) missing.push('branch');
        if (!cfg.path) missing.push('path');
        if (!cfg.token) missing.push('token');
        return missing;
    }

    function safeStorage(type) {
        if (typeof window === 'undefined') return null;
        try {
            return type === 'session' ? window.sessionStorage : window.localStorage;
        } catch (_err) {
            return null;
        }
    }

    function saveGitHubConfig(config, options) {
        const cfg = sanitizeConfig(config);

        const plainConfig = {
            owner: cfg.owner,
            repo: cfg.repo,
            branch: cfg.branch,
            path: cfg.path,
        };

        const local = safeStorage('local');
        const session = safeStorage('session');

        if (local) local.setItem(CONFIG_KEY, JSON.stringify(plainConfig));
        if (session) session.setItem(TOKEN_KEY, cfg.token);
        // Security hardening: token is session-only.
        if (local) local.removeItem(TOKEN_KEY);

        return { ...plainConfig, token: cfg.token };
    }

    function loadGitHubConfig() {
        const local = safeStorage('local');
        const session = safeStorage('session');

        let base = {};
        if (local) {
            const raw = local.getItem(CONFIG_KEY);
            if (raw) {
                try {
                    base = JSON.parse(raw) || {};
                } catch (_err) {
                    base = {};
                }
            }
        }

        const sessionToken = session ? session.getItem(TOKEN_KEY) : '';

        return sanitizeConfig({
            ...base,
            token: sessionToken || '',
        });
    }

    function encodedPath(path) {
        return String(path || '')
            .split('/')
            .filter(Boolean)
            .map((segment) => encodeURIComponent(segment))
            .join('/');
    }

    function githubUrl(config, withRef) {
        const cfg = sanitizeConfig(config);
        const path = encodedPath(cfg.path);
        let url =
            'https://api.github.com/repos/' +
            encodeURIComponent(cfg.owner) +
            '/' +
            encodeURIComponent(cfg.repo) +
            '/contents/' +
            path;
        if (withRef) {
            url += '?ref=' + encodeURIComponent(cfg.branch);
        }
        return url;
    }

    function githubHeaders(token) {
        return {
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer ' + token,
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    async function readResponseJson(response) {
        const text = await response.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (_err) {
            return { message: text };
        }
    }

    function toGithubError(response, data, fallbackMessage) {
        const err = new Error((data && data.message) || fallbackMessage || 'GitHub API error');
        err.status = response.status;
        err.response = data;
        return err;
    }

    async function getRemoteFile(config) {
        const cfg = sanitizeConfig(config);
        const missing = validateGitHubConfig(cfg);
        if (missing.length) {
            throw new Error('Missing GitHub config fields: ' + missing.join(', '));
        }

        const response = await fetch(githubUrl(cfg, true), {
            method: 'GET',
            headers: githubHeaders(cfg.token),
        });

        const data = await readResponseJson(response);
        if (response.status === 404) return { exists: false, sha: null, content: '' };
        if (!response.ok) {
            throw toGithubError(response, data, 'Failed to read remote file');
        }

        return {
            exists: true,
            sha: data.sha || null,
            content: decodeBase64Utf8(data.content || ''),
        };
    }

    async function putRemoteFile(config, contentText, sha, message) {
        const cfg = sanitizeConfig(config);
        const missing = validateGitHubConfig(cfg);
        if (missing.length) {
            throw new Error('Missing GitHub config fields: ' + missing.join(', '));
        }

        const body = {
            message: message || 'Update notes',
            content: encodeBase64Utf8(contentText),
            branch: cfg.branch,
        };

        if (sha) body.sha = sha;

        const response = await fetch(githubUrl(cfg, false), {
            method: 'PUT',
            headers: {
                ...githubHeaders(cfg.token),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await readResponseJson(response);
        if (!response.ok) {
            throw toGithubError(response, data, 'Failed to update remote file');
        }

        return {
            sha: data && data.content ? data.content.sha : null,
            commitSha: data && data.commit ? data.commit.sha : null,
        };
    }

    async function pullDb(config) {
        const file = await getRemoteFile(config);
        if (!file.exists) {
            return { exists: false, sha: null, db: null };
        }

        const parsed = parseRemotePayload(file.content);
        if (!parsed) {
            throw new Error('Remote notes file is not valid JSON format for this app.');
        }

        return {
            exists: true,
            sha: file.sha,
            db: normalizeDb(parsed),
        };
    }

    async function pushDb(config, db, sha, message) {
        const normalized = normalizeDb(db);
        normalized.lastSyncedAt = nowIso();
        const payload = serializeRemotePayload(normalized);
        const result = await putRemoteFile(config, payload, sha, message || 'Sync notes from BLACK SPACE OS');

        return {
            sha: result.sha,
            commitSha: result.commitSha,
            db: normalized,
        };
    }

    async function syncDb(config, localDb) {
        const local = normalizeDb(localDb);
        const remoteFile = await getRemoteFile(config);

        if (!remoteFile.exists) {
            const initialPush = await pushDb(config, local, null, 'Initialize notes from BLACK SPACE OS');
            return {
                mode: 'push-initial',
                sha: initialPush.sha,
                db: initialPush.db,
            };
        }

        const remoteDb = parseRemotePayload(remoteFile.content);
        if (!remoteDb) {
            throw new Error('Remote notes file is not valid JSON format for this app.');
        }

        const merged = mergeDb(local, remoteDb);
        merged.lastSyncedAt = nowIso();

        try {
            const pushed = await pushDb(config, merged, remoteFile.sha, 'Sync notes from BLACK SPACE OS');
            return {
                mode: 'merged',
                sha: pushed.sha,
                db: pushed.db,
            };
        } catch (err) {
            if (err && err.status === 409) {
                const latestFile = await getRemoteFile(config);
                const latestDb = parseRemotePayload(latestFile.content);
                if (!latestDb) throw err;

                const retryMerged = mergeDb(merged, latestDb);
                retryMerged.lastSyncedAt = nowIso();

                const retryPush = await pushDb(config, retryMerged, latestFile.sha, 'Sync notes from BLACK SPACE OS (retry)');
                return {
                    mode: 'merged-retry',
                    sha: retryPush.sha,
                    db: retryPush.db,
                };
            }
            throw err;
        }
    }

    return {
        nowIso,
        normalizeDb,
        mergeDb,
        touchMemo,
        markMemoDeleted,
        getVisibleMemos,
        serializeRemotePayload,
        parseRemotePayload,
        validateGitHubConfig,
        saveGitHubConfig,
        loadGitHubConfig,
        getRemoteFile,
        putRemoteFile,
        pullDb,
        pushDb,
        syncDb,
    };
});
