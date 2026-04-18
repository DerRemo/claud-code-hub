import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semverGt, createChecker } from './update-check.js';

test('semverGt — returns true when a > b', () => {
  assert.equal(semverGt('0.7.1', '0.7.0'), true);
  assert.equal(semverGt('1.0.0', '0.9.9'), true);
  assert.equal(semverGt('0.8.0', '0.7.99'), true);
});

test('semverGt — returns false when a <= b', () => {
  assert.equal(semverGt('0.7.0', '0.7.1'), false);
  assert.equal(semverGt('0.7.0', '0.7.0'), false);
  assert.equal(semverGt('0.9.9', '1.0.0'), false);
});

test('semverGt — tolerates v-prefix', () => {
  assert.equal(semverGt('v0.7.1', 'v0.7.0'), true);
  assert.equal(semverGt('v0.7.1', '0.7.0'), true);
});

test('semverGt — returns false on malformed input', () => {
  assert.equal(semverGt('not-a-version', '0.7.0'), false);
  assert.equal(semverGt('0.7.1', 'not-a-version'), false);
  assert.equal(semverGt('', ''), false);
});

test('createChecker — success case populates state', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      tag_name: 'v0.7.1',
      published_at: '2026-04-20T10:00:00Z',
      html_url: 'https://github.com/x/y/releases/tag/v0.7.1',
      body: '## Notes\n- change',
    }),
  });
  const checker = createChecker({ current: '0.7.0', fetch: fakeFetch });
  await checker.check();
  const s = checker.getState();
  assert.equal(s.current, '0.7.0');
  assert.equal(s.latest, '0.7.1');
  assert.equal(s.isNewer, true);
  assert.equal(s.url, 'https://github.com/x/y/releases/tag/v0.7.1');
  assert.equal(s.changelogMd, '## Notes\n- change');
  assert.equal(s.error, null);
  assert.ok(s.checkedAt > 0);
});

test('createChecker — HTTP error preserves previous state, sets error field', async () => {
  let callCount = 0;
  const fakeFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return { ok: true, json: async () => ({
        tag_name: 'v0.7.1', published_at: '2026-04-20T10:00:00Z',
        html_url: 'https://x', body: 'old',
      }) };
    }
    return { ok: false, status: 403 };
  };
  const checker = createChecker({ current: '0.7.0', fetch: fakeFetch });
  await checker.check();
  await checker.check();
  const s = checker.getState();
  assert.equal(s.latest, '0.7.1');
  assert.equal(s.changelogMd, 'old');
  assert.equal(s.error, 'GitHub API 403');
});

test('createChecker — network rejection is swallowed, error recorded', async () => {
  const fakeFetch = async () => { throw new Error('network down'); };
  const checker = createChecker({ current: '0.7.0', fetch: fakeFetch });
  await checker.check();
  const s = checker.getState();
  assert.equal(s.error, 'network down');
  assert.equal(s.latest, null);
  assert.equal(s.isNewer, false);
});

test('createChecker — isNewer false when current == latest', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v0.7.0', published_at: 'x', html_url: 'x', body: '' }),
  });
  const checker = createChecker({ current: '0.7.0', fetch: fakeFetch });
  await checker.check();
  assert.equal(checker.getState().isNewer, false);
});

test('createChecker — empty body becomes empty string (no null)', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v0.7.1', published_at: 'x', html_url: 'x' /* no body */ }),
  });
  const checker = createChecker({ current: '0.7.0', fetch: fakeFetch });
  await checker.check();
  assert.equal(checker.getState().changelogMd, '');
});
