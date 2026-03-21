import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const locales = {};

function loadLocale(lang) {
  if (!locales[lang]) {
    try {
      locales[lang] = JSON.parse(readFileSync(join(__dirname, `${lang}.json`), 'utf-8'));
    } catch {
      locales[lang] = {};
    }
  }
  return locales[lang];
}

let currentLang = 'en';

export function setLanguage(lang) {
  currentLang = lang;
  loadLocale(lang);
}

export function t(key) {
  const locale = loadLocale(currentLang);
  return locale[key] || key;
}
