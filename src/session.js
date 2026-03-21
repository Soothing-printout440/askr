import { readSessionIndex, writeSessionIndex, readSession, writeSession, pruneSessionIndex } from './storage.js';

export function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const index = readSessionIndex();
  const existingIds = new Set(index.map(s => s.id));
  let id;
  do {
    id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (existingIds.has(id));
  return id;
}

export function createSession(question) {
  const id = generateSessionId();
  const session = {
    id,
    createdAt: new Date().toISOString(),
    status: 'running',
    question,
    thinking: '',
    answer: '',
    error: null,
    checkCount: 0,
    streamBuffer: ''
  };
  writeSession(id, session);

  const index = readSessionIndex();
  index.unshift({
    id,
    createdAt: session.createdAt,
    status: 'running',
    questionPreview: question.slice(0, 80)
  });
  writeSessionIndex(index);
  pruneSessionIndex();

  return session;
}

export function getSession(id) {
  return readSession(id);
}

export function updateSession(id, patch) {
  const session = readSession(id);
  if (!session) return null;
  Object.assign(session, patch);
  writeSession(id, session);

  if (patch.status) {
    const index = readSessionIndex();
    const entry = index.find(s => s.id === id);
    if (entry) {
      entry.status = patch.status;
      writeSessionIndex(index);
    }
  }
  return session;
}

export function getRecentSessions(count = 10) {
  const index = readSessionIndex();
  return index.slice(0, count);
}

export function closeSession(id) {
  return updateSession(id, { status: 'closed' });
}
