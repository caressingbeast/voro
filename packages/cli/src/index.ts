#!/usr/bin/env node

import { Command } from 'commander';

import { mock } from './commands/mock.js';

const program = new Command();

program
  .name('voro')
  .description('Mock smarter, not harder.')
  .version('0.1.0');

program
  .command('mock')
  .description('Mock data based on TypeScript or Zod types')
  .option('-f, --file <path>', 'Path to the TypeScript or Zod file')
  .option("-n, --name <name>, Zod schema name to mock")
  .option('-t, --type <name>', 'TypeScript type name to mock')
  .option('-o, --out <path>', 'Where to write mock data (optional)')
  .action(async (opts) => {
    mock(opts);
  });

program.parse(process.argv);
