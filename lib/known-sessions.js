// Persistente Liste aller dem Hub bekannten tmux-Sessions.
//
// Zweck: Recovery nach Reboot/Kill ("dormant" Sessions neu anlegen können)
// und Adoption fremder tmux-Sessions. Einzige Source of Truth für den
// Restore-Pfad ist diese Datei — tmux kennt die cwd/command-Metadaten
// einer toten Session nicht mehr.
//
// Datenmodell: { knownSessions: [ { name, directory, command, createdAt, lastSeenAt } ] }
// Atomare Writes via temp-file + rename, damit ein Crash die Datei nicht
// halb überschrieben hinterlässt.

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STORE_DIR = join(homedir(), '.claude-code-hub');
const STORE_PATH = join(STORE_DIR, 'sessions.json');

let state = { knownSessions: [] };
let loaded = false;
let saveQueue = Promise.resolve();

export async function load() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.knownSessions)) {
      state = { knownSessions: parsed.knownSessions };
    } else {
      state = { knownSessions: [] };
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      state = { knownSessions: [] };
    } else if (err instanceof SyntaxError) {
      // Korrupte Datei → umbenennen und frisch weitermachen.
      const backup = `${STORE_PATH}.corrupt-${Date.now()}`;
      try {
        await fs.rename(STORE_PATH, backup);
        console.warn(`[known-sessions] sessions.json korrupt, umbenannt nach ${backup}`);
      } catch (renameErr) {
        console.warn(`[known-sessions] sessions.json korrupt, Backup fehlgeschlagen: ${renameErr.message}`);
      }
      state = { knownSessions: [] };
    } else {
      throw err;
    }
  }
  loaded = true;
}

function save() {
  const doSave = async () => {
    await fs.mkdir(STORE_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmp, STORE_PATH);
  };
  saveQueue = saveQueue.then(doSave, doSave);
  return saveQueue;
}

function assertLoaded() {
  if (!loaded) throw new Error('known-sessions: call load() before use');
}

export function list() {
  assertLoaded();
  return state.knownSessions.map(e => ({ ...e }));
}

export function find(name) {
  assertLoaded();
  return state.knownSessions.find(e => e.name === name) || null;
}

export async function add({ name, directory, command }) {
  assertLoaded();
  const now = new Date().toISOString();
  const existing = state.knownSessions.find(e => e.name === name);
  if (existing) {
    existing.directory = directory;
    existing.command = command;
    existing.lastSeenAt = now;
  } else {
    state.knownSessions.push({ name, directory, command, createdAt: now, lastSeenAt: now });
  }
  await save();
}

export async function remove(name) {
  assertLoaded();
  const before = state.knownSessions.length;
  state.knownSessions = state.knownSessions.filter(e => e.name !== name);
  const changed = state.knownSessions.length !== before;
  if (changed) await save();
  return changed;
}

export async function rename(oldName, newName) {
  assertLoaded();
  if (oldName === newName) return true;
  const entry = state.knownSessions.find(e => e.name === oldName);
  if (!entry) return false;
  if (state.knownSessions.some(e => e.name === newName)) return false;
  entry.name = newName;
  entry.lastSeenAt = new Date().toISOString();
  await save();
  return true;
}

export async function touchMany(names) {
  assertLoaded();
  if (!names.length) return;
  const now = new Date().toISOString();
  let changed = false;
  for (const name of names) {
    const entry = state.knownSessions.find(e => e.name === name);
    if (entry) {
      entry.lastSeenAt = now;
      changed = true;
    }
  }
  if (changed) await save();
}

// Per-Session Mute-Flag für Notifications. Default: unmuted (= laut).
// Fremd-Sessions ohne known-Eintrag gelten ebenfalls als unmuted —
// das ist eine absichtliche Asymmetrie, damit der Notification-Poller
// nicht jede adoptionswürdige Session automatisch in die Registry drückt.
export function isMuted(name) {
  assertLoaded();
  const entry = state.knownSessions.find(e => e.name === name);
  return !!(entry && entry.muted === true);
}

export async function setMuted(name, muted) {
  assertLoaded();
  const entry = state.knownSessions.find(e => e.name === name);
  if (!entry) return false;
  const next = !!muted;
  if ((entry.muted === true) === next) return true; // no-op
  if (next) entry.muted = true;
  else delete entry.muted; // kompakt halten: `false` nicht persistieren
  await save();
  return true;
}

// Per-Session Pin-Flag. Default: unpinned. Fremd-Sessions ohne known-
// Eintrag werden beim setPinned mit 404 abgelehnt, weil wir nichts zu
// persistieren haben und keine Auto-Adoption triggern wollen — dieselbe
// Asymmetrie wie bei muted.
export function isPinned(name) {
  assertLoaded();
  const entry = state.knownSessions.find(e => e.name === name);
  return !!(entry && entry.pinned === true);
}

export async function setPinned(name, pinned) {
  assertLoaded();
  const entry = state.knownSessions.find(e => e.name === name);
  if (!entry) return false;
  const next = !!pinned;
  if ((entry.pinned === true) === next) return true; // no-op
  if (next) entry.pinned = true;
  else delete entry.pinned; // kompakt halten
  await save();
  return true;
}

// Pfad für Tests/Debug.
export const _internal = { STORE_PATH };
