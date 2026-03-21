#!/usr/bin/env node
import { argv } from 'process';

if (argv.includes('--manage') || argv.includes('-m')) {
  const { startManage } = await import('./src/manage.js');
  await startManage();
} else {
  const { startServer } = await import('./src/server.js');
  await startServer();
}
