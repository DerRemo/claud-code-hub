import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlinkSync, writeFileSync, realpathSync } from 'fs';
import { join } from 'path';
import { makeTempProject } from './files.test-helpers.js';
import { resolveSafe, listDir, FileError, readFile, streamFileToResponse } from './files.js';

test('resolveSafe rejects parent traversal', () => {
  const { root, cleanup } = makeTempProject({ 'a.txt': 'hi' });
  assert.throws(
    () => resolveSafe(root, '../../../etc/passwd'),
    (err) => err instanceof FileError && err.code === 'forbidden'
  );
  cleanup();
});

test('resolveSafe rejects symlink that escapes', () => {
  const { root, cleanup } = makeTempProject({ 'a.txt': 'hi' });
  symlinkSync('/etc', join(root, 'out'));
  assert.throws(
    () => resolveSafe(root, 'out/passwd'),
    (err) => err instanceof FileError && err.code === 'forbidden'
  );
  cleanup();
});

test('resolveSafe normalizes relative paths inside root', () => {
  const { root, cleanup } = makeTempProject({ 'a/b.txt': 'hi' });
  const abs = resolveSafe(root, './a/../a/b.txt');
  assert.equal(abs, join(realpathSync(root), 'a/b.txt'));
  cleanup();
});

test('listDir returns sorted entries, dirs first, hides ignores', () => {
  const { root, cleanup } = makeTempProject({
    'src/index.js': 'x',
    'src/lib/a.js': 'x',
    'README.md': '#',
    'node_modules/x/p.json': '{}',
    '.git/HEAD': 'ref',
  });
  const result = listDir(root, '');
  const names = result.entries.map(e => e.name);
  assert.deepEqual(names, ['src', 'README.md']);
  cleanup();
});

test('listDir with all=true includes dotfiles', () => {
  const { root, cleanup } = makeTempProject({
    '.env': 'KEY=1',
    'README.md': '#',
  });
  const result = listDir(root, '', { all: true });
  assert.deepEqual(result.entries.map(e => e.name).sort(), ['.env', 'README.md']);
  cleanup();
});

test('readFile returns text content with detected mime', async () => {
  const { root, cleanup } = makeTempProject({ 'a.js': 'console.log(1);' });
  const result = await readFile(root, 'a.js');
  assert.equal(result.kind, 'text');
  assert.equal(result.buffer.toString('utf8'), 'console.log(1);');
  assert.equal(result.detectedLang, 'javascript');
  cleanup();
});

test('readFile rejects text over 2 MB', async () => {
  const { root, cleanup } = makeTempProject({ 'big.txt': 'x'.repeat(2_200_000) });
  await assert.rejects(
    readFile(root, 'big.txt'),
    (err) => err.code === 'oversize' && err.meta.size > 2_000_000
  );
  cleanup();
});

test('readFile accepts 9 MB image', async () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(9_000_000),
  ]);
  const { root, cleanup } = makeTempProject({});
  const { writeFileSync } = await import('fs');
  writeFileSync(join(root, 'big.png'), png);
  const result = await readFile(root, 'big.png');
  assert.equal(result.kind, 'image');
  assert.equal(result.mime, 'image/png');
  cleanup();
});

test('readFile rejects binary non-image non-pdf', async () => {
  const { root, cleanup } = makeTempProject({});
  const { writeFileSync } = await import('fs');
  writeFileSync(join(root, 'app.bin'), Buffer.from([0, 1, 2, 3, 4, 5, 0, 0, 0]));
  await assert.rejects(
    readFile(root, 'app.bin'),
    (err) => err.code === 'unsupported'
  );
  cleanup();
});

import { mkdir, renameOrMove, copy, deleteToTrash } from './files.js';
import { existsSync, readFileSync } from 'fs';

test('mkdir creates nested dirs', async () => {
  const { root, cleanup } = makeTempProject({});
  await mkdir(root, '', 'newfolder');
  assert.equal(existsSync(join(root, 'newfolder')), true);
  cleanup();
});

test('renameOrMove inside project', async () => {
  const { root, cleanup } = makeTempProject({ 'a.txt': 'hi' });
  await renameOrMove(root, 'a.txt', 'b.txt');
  assert.equal(existsSync(join(root, 'b.txt')), true);
  assert.equal(existsSync(join(root, 'a.txt')), false);
  cleanup();
});

test('copy file preserves content', async () => {
  const { root, cleanup } = makeTempProject({ 'a.txt': 'hello' });
  await copy(root, 'a.txt', 'b.txt');
  assert.equal(readFileSync(join(root, 'b.txt'), 'utf8'), 'hello');
  assert.equal(existsSync(join(root, 'a.txt')), true);
  cleanup();
});

test('deleteToTrash moves file to trash', async () => {
  const { root, cleanup } = makeTempProject({ 'gone.txt': 'bye' });
  await deleteToTrash(root, ['gone.txt']);
  assert.equal(existsSync(join(root, 'gone.txt')), false);
  cleanup();
});

import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

function createMockRes() {
  const headers = {};
  const chunks = [];
  return {
    setHeader(k, v) { headers[k] = v; },
    getHeader(k) { return headers[k]; },
    on: () => {},
    once: () => {},
    emit: () => {},
    write(chunk) { chunks.push(chunk); return true; },
    end() { this._ended = true; },
    get _body() { return Buffer.concat(chunks.map(c => Buffer.isBuffer(c) ? c : Buffer.from(c))).toString(); },
    _ended: false,
    _headers: headers,
  };
}

test('streamFileToResponse — sets headers and streams body', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cchub-dl-'));
  writeFileSync(join(dir, 'hello.txt'), 'Hello, World!');
  const res = createMockRes();
  const stream = streamFileToResponse(dir, 'hello.txt', res);
  await new Promise(r => stream.on('end', r));
  assert.equal(res.getHeader('Content-Length'), 13);
  assert.equal(res.getHeader('Content-Type'), 'application/octet-stream');
  assert.match(res.getHeader('Content-Disposition'), /attachment;.*filename="hello\.txt"/);
  rmSync(dir, { recursive: true, force: true });
});

test('streamFileToResponse — RFC5987 encodes non-ASCII filenames', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cchub-dl-'));
  writeFileSync(join(dir, 'Grüße.txt'), 'hi');
  const res = createMockRes();
  const rs = streamFileToResponse(dir, 'Grüße.txt', res);
  await new Promise(r => rs.on('end', r));
  const disp = res.getHeader('Content-Disposition');
  assert.match(disp, /filename\*=UTF-8''/);
  assert.match(disp, /Gr%C3%BC%C3%9Fe\.txt/);
  rmSync(dir, { recursive: true, force: true });
});

test('streamFileToResponse — path-guard rejects escape', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cchub-dl-'));
  const res = createMockRes();
  assert.throws(() => streamFileToResponse(dir, '../../etc/passwd', res), FileError);
  rmSync(dir, { recursive: true, force: true });
});

test('streamFileToResponse — throws on directory (not a file)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cchub-dl-'));
  mkdirSync(join(dir, 'subdir'));
  const res = createMockRes();
  assert.throws(() => streamFileToResponse(dir, 'subdir', res), err => err.code === 'not-a-file');
  rmSync(dir, { recursive: true, force: true });
});

test('streamFileToResponse — throws FileError on missing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cchub-dl-'));
  const res = createMockRes();
  assert.throws(() => streamFileToResponse(dir, 'missing.txt', res), err => err.code === 'not-found');
  rmSync(dir, { recursive: true, force: true });
});
