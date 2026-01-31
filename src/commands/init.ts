/**
 * init command - scaffold a porter.yaml manifest
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { generateManifest, saveManifest, loadManifest } from '../lib/manifest.js';

export interface InitOptions {
  name?: string;
  description?: string;
  force?: boolean;
}

export async function initCommand(workspacePath: string, options: InitOptions = {}): Promise<void> {
  const resolvedPath = path.resolve(workspacePath || '.');

  console.log(chalk.blue(`\n🚀 Initializing OpenClaw Porter in ${resolvedPath}\n`));

  // Check if manifest already exists
  const existingManifest = await loadManifest(resolvedPath);
  if (existingManifest && !options.force) {
    console.log(chalk.yellow('⚠️  porter.yaml already exists. Use --force to overwrite.'));
    return;
  }

  // Check for SOUL.md
  const soulPath = path.join(resolvedPath, 'SOUL.md');
  if (!(await fs.pathExists(soulPath))) {
    console.log(chalk.red('❌ No SOUL.md found. This directory doesn\'t look like an agent workspace.'));
    console.log(chalk.gray('   Create a SOUL.md file first, then run init again.'));
    return;
  }

  // Generate manifest from detected files
  const manifest = await generateManifest(resolvedPath, {
    name: options.name,
    description: options.description,
  });

  // Save manifest
  await saveManifest(resolvedPath, manifest);

  console.log(chalk.green('✅ Created porter.yaml\n'));

  // Report what was detected
  console.log(chalk.bold('Detected configuration:'));
  console.log(`  Name: ${chalk.cyan(manifest.name)}`);
  console.log(`  Version: ${chalk.cyan(manifest.version)}`);

  console.log(`\n  Context files:`);
  for (const [key, value] of Object.entries(manifest.context)) {
    if (value) {
      console.log(`    ${chalk.gray('-')} ${key}: ${chalk.cyan(value)}`);
    }
  }

  if (manifest.skills?.bundled?.length) {
    console.log(`\n  Bundled skills:`);
    for (const skill of manifest.skills.bundled) {
      console.log(`    ${chalk.gray('-')} ${chalk.cyan(skill.path)}`);
    }
  }

  if (manifest.assets?.length) {
    console.log(`\n  Assets:`);
    for (const asset of manifest.assets) {
      console.log(`    ${chalk.gray('-')} ${chalk.cyan(asset)}`);
    }
  }

  console.log(chalk.gray('\n📝 Edit porter.yaml to add environment variables, external skills, etc.'));
  console.log(chalk.gray('   Then run: openclaw-porter export\n'));
}
