import envPaths from 'env-paths';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const paths = envPaths('askr');
const dataDir = paths.data;
const sessionsDir = join(dataDir, 'sessions');

export function getDataDir() {
  mkdirSync(sessionsDir, { recursive: true });
  return dataDir;
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const configPath = join(dataDir, 'config.json');
const indexPath = join(sessionsDir, 'index.json');

export function readConfig() {
  return readJson(configPath);
}

export function writeConfig(data) {
  writeJson(configPath, data);
}

export function getConfigPath() {
  return configPath;
}

export function readSessionIndex() {
  return readJson(indexPath) || [];
}

export function writeSessionIndex(list) {
  writeJson(indexPath, list);
}

export function readSession(id) {
  return readJson(join(sessionsDir, `${id}.json`));
}

export function writeSession(id, data) {
  writeJson(join(sessionsDir, `${id}.json`), data);
}

export function pruneSessionIndex() {
  const list = readSessionIndex();
  if (list.length > 100) {
    writeSessionIndex(list.slice(0, 100));
  }
}
