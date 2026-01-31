/**
 * export command - package an agent for distribution
 */

import path from 'path';
import chalk from 'chalk';
import { exportAgent } from '../lib/exporter.js';
import type { ExportOptions } from '../types.js';

export async function exportCommand(
  workspacePath: string,
  options: ExportOptions = {}
): Promise<void> {
  const resolvedPath = path.resolve(workspacePath || '.');

  console.log(chalk.blue(`\n📦 Exporting agent from ${resolvedPath}\n`));

  const result = await exportAgent(resolvedPath, options);

  if (!result.success) {
    console.log(chalk.red('❌ Export failed:\n'));
    for (const error of result.errors || []) {
      console.log(chalk.red(`   ${error}`));
    }
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 Dry run - files that would be exported:\n'));
    for (const file of result.files) {
      console.log(chalk.gray(`   ${file}`));
    }
    console.log(chalk.gray(`\n   Total: ${result.files.length} files`));
    return;
  }

  console.log(chalk.green('✅ Export successful!\n'));
  console.log(`   Output: ${chalk.cyan(result.outputPath)}`);
  console.log(`   Files: ${chalk.cyan(result.files.length)}`);

  console.log(chalk.gray('\n📤 To share on GitHub:'));
  console.log(chalk.gray('   1. Create repo: openclaw-agent-<name>'));
  console.log(chalk.gray('   2. Extract and push the archive contents'));
  console.log(chalk.gray('   3. Tag release: git tag v1.0.0 && git push --tags\n'));
}
