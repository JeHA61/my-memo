const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeDb,
    mergeDb,
    markMemoDeleted,
    parseRemotePayload,
    serializeRemotePayload,
    validateGitHubConfig,
} = require('./sync.js');

test('normalizeDb: legacy shape gets normalized', () => {
    const db = normalizeDb({
        folders: ['General', '', 'Work', 'Work'],
        memos: [
            {
                id: 1,
                folder: 'Work',
                title: 'hello',
                content: 'world',
                date: '2026-01-01T00:00:00.000Z',
            },
        ],
    });

    assert.deepEqual(db.folders, ['General', 'Work']);
    assert.equal(db.memos.length, 1);
    assert.equal(db.memos[0].id, '1');
    assert.equal(db.memos[0].updatedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(db.memos[0].deletedAt, null);
});

test('mergeDb: newer memo wins by updatedAt', () => {
    const local = normalizeDb({
        folders: ['General'],
        memos: [
            {
                id: 'm1',
                folder: 'General',
                title: 'old',
                content: 'local-old',
                date: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                deletedAt: null,
            },
        ],
    });

    const remote = normalizeDb({
        folders: ['General'],
        memos: [
            {
                id: 'm1',
                folder: 'General',
                title: 'new',
                content: 'remote-new',
                date: '2026-01-02T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
                deletedAt: null,
            },
        ],
    });

    const merged = mergeDb(local, remote);
    assert.equal(merged.memos.length, 1);
    assert.equal(merged.memos[0].title, 'new');
    assert.equal(merged.memos[0].content, 'remote-new');
});

test('mergeDb: deletion tombstone wins and is preserved', () => {
    const local = normalizeDb({
        folders: ['General'],
        memos: [
            {
                id: 'm1',
                folder: 'General',
                title: 'keep?',
                content: 'text',
                date: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                deletedAt: null,
            },
        ],
    });

    const remote = normalizeDb({
        folders: ['General'],
        memos: [],
        memoTombstones: {
            m1: '2026-01-03T00:00:00.000Z',
        },
    });

    const merged = mergeDb(local, remote);
    const memo = merged.memos.find((m) => m.id === 'm1');

    assert.ok(memo);
    assert.equal(memo.deletedAt, '2026-01-03T00:00:00.000Z');
    assert.equal(merged.memoTombstones.m1, '2026-01-03T00:00:00.000Z');
});

test('markMemoDeleted: updates memo and tombstone map', () => {
    const db = normalizeDb({
        folders: ['General'],
        memos: [
            {
                id: 'm1',
                folder: 'General',
                title: 'memo',
                content: 'body',
                date: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                deletedAt: null,
            },
        ],
    });

    markMemoDeleted(db, 'm1', '2026-01-05T00:00:00.000Z');

    assert.equal(db.memoTombstones.m1, '2026-01-05T00:00:00.000Z');
    assert.equal(db.memos[0].deletedAt, '2026-01-05T00:00:00.000Z');
});

test('serializeRemotePayload/parseRemotePayload: roundtrip works', () => {
    const original = normalizeDb({
        folders: ['General'],
        memos: [
            {
                id: 'm1',
                folder: 'General',
                title: 'memo',
                content: 'body',
                date: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                deletedAt: null,
            },
        ],
    });

    const payload = serializeRemotePayload(original);
    const parsed = parseRemotePayload(payload);

    assert.ok(parsed);
    assert.equal(parsed.memos[0].id, 'm1');
    assert.equal(parsed.folders[0], 'General');
});

test('validateGitHubConfig: reports missing fields', () => {
    const missing = validateGitHubConfig({ owner: '', repo: 'r', branch: '', path: '', token: '' });
    assert.deepEqual(missing, ['owner', 'token']);
});
