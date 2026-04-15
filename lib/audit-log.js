// Append-only JSONL-Audit-Log für security-relevante Events.
//
// Jeder Event eine JSON-Line in ~/.claude-code-hub/audit.log.
// Size-basierte Rotation: bei >10MB wird umbenannt (audit.log → .log.1,
// .log.1 → .log.2, .log.2 → .log.3, alte .3 geht verloren).
//
// Writes sind serialisiert via saveQueue Promise-Chain — identisches
// Muster wie lib/known-sessions.js. Damit sind Rotationen race-frei
// gegen parallele Event-Writes.
//
// Crash-Safety: fs.appendFile ist atomar für Writes ≤ PIPE_BUF (4096B
// auf macOS). Unsere Records sind 200-500B. Bei Prozess-Crash mitten
// im Write bleibt höchstens eine unvollständige letzte Line — jq
// überspringt die, Datei bleibt sonst intakt.

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STORE_DIR = join(homedir(), '.claude-code-hub');
const AUDIT_PATH = join(STORE_DIR, 'audit.log');
const MAX_SIZE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_ARCHIVES = 3;

let cachedSize = null;  // null = uninitialized, sonst Bytes
let saveQueue = Promise.resolve();

async function initCachedSize() {
  if (cachedSize !== null) return;
  try {
    const s = await fs.stat(AUDIT_PATH);
    cachedSize = s.size;
  } catch (err) {
    if (err.code === 'ENOENT') cachedSize = 0;
    else throw err;
  }
}

async function maybeRotate(incomingBytes) {
  await initCachedSize();
  if (cachedSize + incomingBytes < MAX_SIZE_BYTES) return;
  // Rotate: .2 → .3, .1 → .2, active → .1. Alte .3 wird überschrieben.
  for (let i = MAX_ARCHIVES - 1; i >= 1; i--) {
    try {
      await fs.rename(`${AUDIT_PATH}.${i}`, `${AUDIT_PATH}.${i + 1}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  try {
    await fs.rename(AUDIT_PATH, `${AUDIT_PATH}.1`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  cachedSize = 0;
}

async function doRecord(event, fields) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  const line = JSON.stringify(payload) + '\n';
  const bytes = Buffer.byteLength(line, 'utf-8');
  await fs.mkdir(STORE_DIR, { recursive: true });
  await maybeRotate(bytes);
  await fs.appendFile(AUDIT_PATH, line, 'utf-8');
  cachedSize = (cachedSize || 0) + bytes;
}

// Serialisiert den Write gegen parallele Calls. Gibt das Promise des
// Write-Calls zurück — Caller kann `await` wenn sie Crash-Safety wollen,
// oder fire-and-forget wenn Latency wichtiger ist.
export function record(event, fields = {}) {
  const next = saveQueue.then(() => doRecord(event, fields), () => doRecord(event, fields));
  saveQueue = next.catch(() => {});  // Chain schwalbt Errors, damit der nächste Write nicht auf dem alten Fehler stehen bleibt
  return next;
}

// Extrahiert Standard-Request-Meta. Benutzt req.cchContext falls
// secureMiddleware es gesetzt hat (enthält user aus JWT-Claim).
export function extractRequestMeta(req) {
  return {
    user: req.cchContext?.user || null,
    ip: req.headers['cf-connecting-ip'] || req.ip || null,
    cfRay: req.headers['cf-ray'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

// Nur für Tests/Debug.
export const _internal = { AUDIT_PATH, MAX_SIZE_BYTES, MAX_ARCHIVES };
