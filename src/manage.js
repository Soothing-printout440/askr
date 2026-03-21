import { select, input, confirm, editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig, defaultConfig } from './config.js';
import { setLanguage, t } from './i18n/index.js';
import { getRecentSessions, getSession, closeSession } from './session.js';
import { getDataDir, readSessionIndex } from './storage.js';

export async function startManage() {
  getDataDir();
  let config = loadConfig();

  if (!config) {
    const lang = await select({
      message: 'Choose language / 请选择语言:',
      choices: [
        { name: '简体中文', value: 'zh-CN' },
        { name: 'English', value: 'en' }
      ]
    });
    config = defaultConfig(lang);
    saveConfig(config);
  }

  setLanguage(config.language);

  while (true) {
    const action = await select({
      message: t('menu.title'),
      choices: [
        { name: t('menu.provider'), value: 'provider' },
        { name: t('menu.sessions'), value: 'sessions' },
        { name: t('menu.logs'), value: 'logs' },
        { name: t('menu.settings'), value: 'settings' },
        { name: t('menu.exit'), value: 'exit' }
      ]
    });

    if (action === 'exit') process.exit(0);
    if (action === 'provider') await manageProvider(config);
    if (action === 'sessions') await manageSessions(config);
    if (action === 'logs') await viewLogs(config);
    if (action === 'settings') await moreSettings(config);
  }
}

async function manageProvider(config) {
  const baseUrl = await input({
    message: `${t('provider.baseUrl')} ${chalk.dim(t('provider.baseUrlHint'))}`,
    default: config.provider.baseUrl || ''
  });
  config.provider.baseUrl = baseUrl.replace(/\/+$/, '');

  const apiKey = await input({
    message: t('provider.apiKey'),
    default: config.provider.apiKey || '',
    transformer: (v) => '*'.repeat(v.length)
  });
  config.provider.apiKey = apiKey;

  // Try fetching models
  let model = '';
  try {
    console.log(chalk.dim(t('provider.testingModels')));
    const url = config.provider.baseUrl.replace(/\/+$/, '') + '/v1/models';
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      if (models.length > 0) {
        model = await select({
          message: t('provider.model'),
          choices: models.map(m => ({ name: m, value: m }))
        });
      }
    }
  } catch {}

  if (!model) {
    console.log(chalk.yellow(t('provider.modelFetchFail')));
    model = await input({
      message: t('provider.modelManual'),
      default: config.provider.model || ''
    });
  }
  config.provider.model = model;

  saveConfig(config);
  console.log(chalk.green(t('provider.saved')));
}

async function manageSessions(config) {
  const index = readSessionIndex().filter(s => s.status === 'running' || s.status === 'timeout');

  if (index.length === 0) {
    console.log(chalk.dim(t('sessions.empty')));
    return;
  }

  const choices = index.map(s => ({
    name: `[${s.id}] ${s.createdAt.slice(0, 16).replace('T', ' ')} | ${s.status} | ${s.questionPreview}`,
    value: s.id
  }));
  choices.push({ name: t('sessions.back'), value: '__back' });

  const selected = await select({ message: t('sessions.title'), choices });
  if (selected === '__back') return;

  const session = getSession(selected);
  if (!session) return;

  console.log(chalk.bold('ID:'), session.id);
  console.log(chalk.bold('Status:'), session.status);
  console.log(chalk.bold('Question:'), session.question);
  if (session.answer) console.log(chalk.bold('Answer:'), session.answer.slice(0, 200));

  const action = await select({
    message: '',
    choices: [
      { name: t('sessions.close'), value: 'close' },
      { name: t('sessions.back'), value: 'back' }
    ]
  });

  if (action === 'close') {
    const yes = await confirm({ message: t('sessions.closeConfirm') });
    if (yes) {
      closeSession(selected);
      console.log(chalk.green(t('sessions.closed')));
    }
  }
}

async function viewLogs(config) {
  const index = readSessionIndex();
  if (index.length === 0) {
    console.log(chalk.dim(t('logs.empty')));
    return;
  }

  const choices = index.map(s => ({
    name: `[${s.id}] ${s.createdAt.slice(0, 16).replace('T', ' ')} | ${s.status} | ${s.questionPreview}`,
    value: s.id
  }));
  choices.push({ name: t('sessions.back'), value: '__back' });

  const selected = await select({ message: t('logs.title'), choices });
  if (selected === '__back') return;

  let session = getSession(selected);
  if (!session) return;

  const isRunning = session.status === 'running' || session.status === 'timeout';

  function renderSession(s) {
    // Clear screen for refresh
    process.stdout.write('\x1B[2J\x1B[H');
    console.log(chalk.bold('ID:'), s.id);
    console.log(chalk.bold('Created:'), s.createdAt);
    console.log(chalk.bold('Status:'), s.status === 'running' ? chalk.yellow(s.status) : s.status);
    console.log(chalk.bold('Question:'), s.question);

    if (s.thinking) {
      console.log('\n' + chalk.dim('[Thinking]'));
      console.log(chalk.dim(s.thinking));
    }

    if (s.answer || s.streamBuffer) {
      console.log('\n' + chalk.green('[Answer]'));
      console.log(chalk.green(s.answer || s.streamBuffer));
    }

    if (s.error) {
      console.log('\n' + chalk.red('[Error]'));
      console.log(chalk.red(s.error));
    }

    if (s.status === 'running') {
      console.log('\n' + chalk.dim('⟳ ' + t('logs.refreshing')));
    }
    console.log('');
  }

  if (isRunning) {
    // Hot-refresh: poll every 1s until session completes or user presses Enter
    renderSession(session);
    let stopped = false;
    const refreshInterval = setInterval(() => {
      const updated = getSession(selected);
      if (!updated || stopped) { clearInterval(refreshInterval); return; }
      session = updated;
      renderSession(session);
      if (session.status !== 'running') {
        clearInterval(refreshInterval);
        if (!stopped) {
          console.log(chalk.green(t('logs.completed')));
        }
      }
    }, 1000);

    await input({ message: t('logs.back') });
    stopped = true;
    clearInterval(refreshInterval);
  } else {
    renderSession(session);
    await input({ message: t('logs.back') });
  }
}

async function moreSettings(config) {
  const action = await select({
    message: t('settings.title'),
    choices: [
      { name: t('settings.maxConcurrent'), value: 'maxConcurrent' },
      { name: t('settings.timeout'), value: 'timeout' },
      { name: t('settings.foldChars'), value: 'foldChars' },
      { name: t('settings.systemPrompt'), value: 'systemPrompt' },
      { name: t('settings.language'), value: 'language' },
      { name: t('settings.back'), value: 'back' }
    ]
  });

  if (action === 'back') return;

  if (action === 'maxConcurrent') {
    const val = await input({ message: t('settings.maxConcurrent'), default: String(config.settings.maxConcurrent) });
    config.settings.maxConcurrent = parseInt(val) || 5;
  } else if (action === 'timeout') {
    const val = await input({ message: t('settings.timeout'), default: String(config.settings.timeout) });
    config.settings.timeout = parseInt(val) || 150;
  } else if (action === 'foldChars') {
    const val = await input({ message: t('settings.foldChars'), default: String(config.settings.foldChars) });
    config.settings.foldChars = parseInt(val) || 200;
  } else if (action === 'systemPrompt') {
    const val = await editor({ message: t('settings.systemPrompt'), default: config.settings.systemPrompt });
    config.settings.systemPrompt = val.trim();
  } else if (action === 'language') {
    const lang = await select({
      message: t('language.choose'),
      choices: [
        { name: t('language.zhCN'), value: 'zh-CN' },
        { name: t('language.en'), value: 'en' }
      ]
    });
    config.language = lang;
    setLanguage(lang);
  }

  saveConfig(config);
  console.log(chalk.green(t('settings.saved')));
}
