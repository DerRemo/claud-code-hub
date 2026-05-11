import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { browseMkdir, BrowseMkdirError, validateBasename } from './browse-mkdir.js';

function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), 'cchub-mkdir-'));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('validateBasename accepts simple names', () => {
  assert.equal(validateBasename('foo'), true);
  assert.equal(validateBasename('my-folder_1.2'), true);
  assert.equal(validateBasename('Ümläut'), true);
});

test('validateBasename rejects invalid names', () => {
  assert.equal(validateBasename(''), false);
  assert.equal(validateBasename('.'), false);
  assert.equal(validateBasename('..'), false);
  assert.equal(validateBasename('foo/bar'), false);
  assert.equal(validateBasename('foo\\bar'), false);
  assert.equal(validateBasename('foo\0bar'), false);
  assert.equal(validateBasename('a'.repeat(256)), false);
  assert.equal(validateBasename(null), false);
  assert.equal(validateBasename(undefined), false);
});

test('browseMkdir creates a directory under an allowed root', () => {
  const { root, cleanup } = makeSandbox();
  try {
    const target = join(root, 'newdir');
    const out = browseMkdir(target, [root]);
    assert.equal(out, target);
    assert.equal(existsSync(target), true);
  } finally {
    cleanup();
  }
});

test('browseMkdir rejects path outside allowed roots', () => {
  const { root, cleanup } = makeSandbox();
  try {
    const outside = join(tmpdir(), 'cchub-outside-' + Date.now());
    assert.throws(
      () => browseMkdir(outside, [root]),
      (err) => err instanceof BrowseMkdirError && err.code === 'forbidden',
    );
    assert.equal(existsSync(outside), false);
  } finally {
    cleanup();
  }
});

test('browseMkdir rejects ".." basename (parent traversal)', () => {
  const { root, cleanup } = makeSandbox();
  try {
    // join(root, '..') normalizes to the parent of root → outside allowedRoots,
    // but ALSO basename(...) === '..' which validateBasename rejects first.
    assert.throws(
      () => browseMkdir(join(root, '..'), [root]),
      (err) => err instanceof BrowseMkdirError && (err.code === 'invalid_name' || err.code === 'forbidden'),
    );
  } finally {
    cleanup();
  }
});

test('browseMkdir rejects basename containing a backslash', () => {
  const { root, cleanup } = makeSandbox();
  try {
    // On POSIX, "\\" is not a separator, so basename returns "has\\slash" verbatim
    // and validateBasename rejects it.
    assert.throws(
      () => browseMkdir(join(root, 'has\\slash'), [root]),
      (err) => err instanceof BrowseMkdirError && err.code === 'invalid_name',
    );
  } finally {
    cleanup();
  }
});

test('browseMkdir returns "exists" when directory already present', () => {
  const { root, cleanup } = makeSandbox();
  try {
    const target = join(root, 'dup');
    browseMkdir(target, [root]);
    assert.throws(
      () => browseMkdir(target, [root]),
      (err) => err instanceof BrowseMkdirError && err.code === 'exists',
    );
  } finally {
    cleanup();
  }
});

test('browseMkdir wraps unknown errors as "io"', () => {
  const { root, cleanup } = makeSandbox();
  try {
    // Parent dir does not exist — EEXIST is not the issue, ENOENT is.
    const target = join(root, 'no-parent', 'child');
    assert.throws(
      () => browseMkdir(target, [root]),
      (err) => err instanceof BrowseMkdirError && err.code === 'io',
    );
  } finally {
    cleanup();
  }
});
