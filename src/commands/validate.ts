/**
 * validate command - check manifest and files
 */

import path from 'path';
import chalk from 'chalk';
import { loadManifest, validateManifest } from '../lib/manifest.js';
import { scanWorkspace, checkForSecrets } from '../lib/scanner.js';

export async function validateCommand(workspacePath: string): Promise<void> {
  const resolvedPath = path.resolve(workspacePath || '.');

  console.log(chalk.blue(`\n🔍 Validating agent in ${resolvedPath}\n`));

  // Load manifest
  const manifest = await loadManifest(resolvedPath);
  if (!manifest) {
    console.log(chalk.red('❌ No porter.yaml found'));
    console.log(chalk.gray('   Run `openclaw-porter init` to create one'));
    process.exit(1);
  }

  console.log(chalk.bold('Manifest validation:'));

  // Validate manifest
  const validation = validateManifest(manifest);

  if (validation.errors.length > 0) {
    console.log(chalk.red('\n  Errors:'));
    for (const error of validation.errors) {
      console.log(chalk.red(`    ✗ ${error}`));
    }
  }

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('\n  Warnings:'));
    for (const warning of validation.warnings) {
      console.log(chalk.yellow(`    ⚠ ${warning}`));
    }
  }

  if (validation.valid && validation.warnings.length === 0) {
    console.log(chalk.green('  ✓ Manifest is valid'));
  }

  // Scan files
  console.log(chalk.bold('\nFile scan:'));
  const scanResult = await scanWorkspace(resolvedPath, manifest);

  console.log(`  Found ${chalk.cyan(scanResult.files.length)} files`);
  console.log(`  Total size: ${chalk.cyan(formatBytes(scanResult.totalSize))}`);

  if (scanResult.warnings.length > 0) {
    console.log(chalk.yellow('\n  Warnings:'));
    for (const warning of scanResult.warnings) {
      console.log(chalk.yellow(`    ⚠ ${warning}`));
    }
  }

  // Check for secrets
  console.log(chalk.bold('\nSecurity check:'));
  const leaks = await checkForSecrets(resolvedPath, scanResult.files);

  if (leaks.length > 0) {
    console.log(chalk.red('  ✗ Potential secrets detected:'));
    for (const leak of leaks) {
      console.log(chalk.red(`    ${leak.file}:${leak.line} - ${leak.match}`));
    }
  } else {
    console.log(chalk.green('  ✓ No obvious secrets detected'));
  }

  // Summary
  console.log(chalk.bold('\nSummary:'));
  if (validation.valid && leaks.length === 0) {
    console.log(chalk.green('  ✓ Ready to export!\n'));
  } else {
    console.log(chalk.red('  ✗ Fix issues before exporting\n'));
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
