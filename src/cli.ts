#!/usr/bin/env node

/**
 * OpenClaw Porter CLI
 * Export and import AI agents with full context
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';
import { validateCommand } from './commands/validate.js';

const program = new Command();

program
  .name('openclaw-porter')
  .description('Export and import OpenClaw/Clawdbot agents with full context')
  .version('0.1.0');

program
  .command('init [path]')
  .description('Initialize a porter.yaml manifest in an agent workspace')
  .option('-n, --name <name>', 'Agent name (defaults to directory name)')
  .option('-d, --description <desc>', 'Agent description')
  .option('-f, --force', 'Overwrite existing porter.yaml')
  .action(async (path, options) => {
    await initCommand(path || '.', options);
  });

program
  .command('export [path]')
  .description('Export an agent to a portable package')
  .option('-o, --output <dir>', 'Output directory (default: ./dist)')
  .option('--github <repo>', 'Push to GitHub repo (e.g., user/openclaw-agent-name)')
  .option('--dry-run', 'Show what would be exported without creating archive')
  .option('-f, --force', 'Ignore warnings and export anyway')
  .action(async (path, options) => {
    await exportCommand(path || '.', options);
  });

program
  .command('import <source>')
  .description('Import an agent from a package or repository')
  .option('-t, --target <dir>', 'Target directory (default: current directory)')
  .option('--skip-env', 'Skip environment variable checks')
  .option('--skip-skills', 'Skip external skill installation')
  .option('-f, --force', 'Overwrite existing agent directory')
  .action(async (source, options) => {
    await importCommand(source, options);
  });

program
  .command('validate [path]')
  .description('Validate an agent manifest and files')
  .action(async (path) => {
    await validateCommand(path || '.');
  });

program.parse();
