// StatusLine-Daten pro Session: In-Memory-State + historisches Limit-Log.
// Wird von POST /api/hooks/statusline gefüttert.

import { appendFile, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const HUB_DIR = join(homedir(), '.claude-code-hub');
const LIMITS_LOG = join(HUB_DIR, 'usage-limits.jsonl');
const FRESH_MS = 120_000;
const LOG_THROTTLE_MS = 5 * 60_000;
const MAX_LOG_SIZE = 5 * 1024 * 1024;

const states = new Map();
let lastLogValues = '';
let lastLogAt = 0;

export function recordStatusline(sessionName, data) {
  const now = Date.now();
  states.set(sessionName, {
    pct5h: data.pct5h ?? null,
    pct7d: data.pct7d ?? null,
    resets5h: data.resets5h ?? null,
    resets7d: data.resets7d ?? null,
    costUsd: data.costUsd ?? null,
    durationMs: data.durationMs ?? null,
    apiDurationMs: data.apiDurationMs ?? null,
    linesAdded: data.linesAdded ?? null,
    linesRemoved: data.linesRemoved ?? null,
    model: data.model ?? null,
    contextPct: data.contextPct ?? null,
    contextSize: data.contextSize ?? null,
    updatedAt: now,
  });

  const logKey = `${data.pct5h}:${data.pct7d}`;
  if (logKey !== lastLogValues || now - lastLogAt >= LOG_THROTTLE_MS) {
    lastLogValues = logKey;
    lastLogAt = now;
    const line = JSON.stringify({
      t: new Date(now).toISOString(),
      '5h': data.pct5h ?? null,
      '7d': data.pct7d ?? null,
      r5h: data.resets5h ?? null,
      r7d: data.resets7d ?? null,
    }) + '\n';
    appendFile(LIMITS_LOG, line).catch(() => {});
    rotateMaybe().catch(() => {});
  }
}

export function getSessionStatusline(sessionName) {
  const s = states.get(sessionName);
  if (!s) return null;
  if (Date.now() - s.updatedAt >= FRESH_MS) return null;
  return s;
}

export function getAllSessionCosts() {
  let totalUsd = 0;
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;
  let totalDurationMs = 0;
  let totalApiDurationMs = 0;
  const sessions = [];
  for (const [name, s] of states) {
    if (Date.now() - s.updatedAt >= FRESH_MS) continue;
    totalUsd += s.costUsd || 0;
    totalLinesAdded += s.linesAdded || 0;
    totalLinesRemoved += s.linesRemoved || 0;
    totalDurationMs += s.durationMs || 0;
    totalApiDurationMs += s.apiDurationMs || 0;
    sessions.push({ name, costUsd: s.costUsd, linesAdded: s.linesAdded, linesRemoved: s.linesRemoved });
  }
  return { totalUsd, totalLinesAdded, totalLinesRemoved, totalDurationMs, totalApiDurationMs, sessions };
}

export async function getLimitHistory({ days = 7 } = {}) {
  let raw;
  try { raw = await readFile(LIMITS_LOG, 'utf8'); } catch { return { points: [], peaks5h: 0, peaks7d: 0 }; }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const points = [];
  let peaks5h = 0;
  let peaks7d = 0;
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.t < cutoffStr) continue;
    points.push(obj);
    if ((obj['5h'] ?? 0) >= 90) peaks5h++;
    if ((obj['7d'] ?? 0) >= 90) peaks7d++;
  }

  let current = null;
  for (const [, s] of states) {
    if (Date.now() - s.updatedAt < FRESH_MS) {
      current = { pct5h: s.pct5h, pct7d: s.pct7d, resets5h: s.resets5h, resets7d: s.resets7d };
      break;
    }
  }

  return { points, peaks5h, peaks7d, current };
}

export function rename(oldName, newName) {
  if (oldName === newName) return;
  const s = states.get(oldName);
  if (!s) return;
  states.delete(oldName);
  states.set(newName, s);
}

export function forget(sessionName) {
  states.delete(sessionName);
}

async function rotateMaybe() {
  let st;
  try { st = await stat(LIMITS_LOG); } catch { return; }
  if (st.size < MAX_LOG_SIZE) return;
  let raw;
  try { raw = await readFile(LIMITS_LOG, 'utf8'); } catch { return; }
  const lines = raw.split('\n').filter(Boolean);
  const half = Math.floor(lines.length / 2);
  await writeFile(LIMITS_LOG, lines.slice(half).join('\n') + '\n');
}

export function _reset() {
  states.clear();
  lastLogValues = '';
  lastLogAt = 0;
}
