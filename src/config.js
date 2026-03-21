import { readConfig, writeConfig, getConfigPath } from './storage.js';
import chokidar from 'chokidar';

export function loadConfig() {
  return readConfig();
}

export function saveConfig(config) {
  writeConfig(config);
}

export function watchConfig(callback) {
  const configPath = getConfigPath();
  const watcher = chokidar.watch(configPath, { ignoreInitial: true });
  watcher.on('change', () => {
    const config = readConfig();
    if (config) callback(config);
  });
  return watcher;
}

export function buildEndpoint(baseUrl) {
  if (baseUrl.endsWith('#')) {
    return baseUrl.slice(0, -1);
  }
  return baseUrl.replace(/\/+$/, '') + '/v1/chat/completions';
}

export function defaultConfig(language = 'en') {
  return {
    language,
    provider: {
      baseUrl: '',
      apiKey: '',
      model: '',
      customEndpoint: false,
      stream: true
    },
    settings: {
      maxConcurrent: 5,
      timeout: 150,
      foldChars: 1000,
      systemPrompt: 'You are a search assistant. Search as much as possible, answer concisely while retaining useful information. Ensure accuracy.'
    }
  };
}
