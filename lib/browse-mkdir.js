// Helper for POST /api/browse/mkdir.
// Validates a basename (no slash, no ../., no NUL, length 1..255), checks that
// the absolute target path lies under one of the allowedRoots, and creates the
// directory with recursive:false. Throws BrowseMkdirError with a stable `code`.

import { mkdirSync } from 'fs';
import { resolve, sep, basename } from 'path';

export class BrowseMkdirError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BrowseMkdirError';
    this.code = code; // 'invalid_name' | 'forbidden' | 'exists' | 'io'
  }
}

const BASENAME_RE = /^[^/\\\0]+$/;

export function validateBasename(name) {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 255) return false;
  if (name === '.' || name === '..') return false;
  return BASENAME_RE.test(name);
}

function isUnder(p, roots) {
  const r = resolve(p);
  return roots.some(root => r === root || r.startsWith(root + sep));
}

// absPath: absolute target directory path (parent + "/" + basename, already resolved by caller)
// allowedRoots: array of absolute root paths
export function browseMkdir(absPath, allowedRoots) {
  if (typeof absPath !== 'string' || absPath.length === 0) {
    throw new BrowseMkdirError('invalid_name', 'Empty path');
  }
  const name = basename(absPath);
  if (!validateBasename(name)) {
    throw new BrowseMkdirError('invalid_name', `Invalid folder name: ${JSON.stringify(name)}`);
  }
  if (!isUnder(absPath, allowedRoots)) {
    throw new BrowseMkdirError('forbidden', 'Path outside allowed roots');
  }
  try {
    mkdirSync(absPath, { recursive: false });
    return absPath;
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      throw new BrowseMkdirError('exists', 'Directory already exists');
    }
    throw new BrowseMkdirError('io', err && err.message ? err.message : 'mkdir failed');
  }
}
