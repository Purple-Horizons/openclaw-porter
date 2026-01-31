/**
 * import command - install an agent from a package or GitHub
 */

import path from 'path';
import chalk from 'chalk';
import { importAgent, parseSource } from '../lib/importer.js';
import type { ImportOptions } from '../types.js';

export async function importCommand(source: string, options: ImportOptions = {}): Promise<void> {
  const parsed = parseSource(source);

  if (parsed.type === 'github') {
    console.log(chalk.blue(`\n📥 Importing agent from GitHub: ${parsed.path}${parsed.version ? `@${parsed.version}` : ''}\n`));
  } else if (parsed.type === 'clawdhub') {
    console.log(chalk.yellow('⚠️  ClawdHub import not yet implemented'));
    return;
  } else {
    console.log(chalk.blue(`\n📥 Importing agent from ${source}\n`));
  }

  const result = await importAgent(source, options);

  if (!result.success) {
    console.log(chalk.red('❌ Import failed:\n'));
    for (const error of result.errors || []) {
      console.log(chalk.red(`   ${error}`));
    }
    process.exit(1);
  }

  console.log(chalk.green('✅ Import successful!\n'));
  console.log(`   Agent installed to: ${chalk.cyan(result.agentPath)}`);

  if (result.missingEnv?.length) {
    console.log(chalk.yellow('\n⚠️  Missing environment variables:'));
    for (const envVar of result.missingEnv) {
      console.log(chalk.yellow(`   - ${envVar}`));
    }
    console.log(chalk.gray('\n   Set these in your .env file or shell environment'));
  }

  if (result.installedSkills?.length) {
    console.log(chalk.gray('\n📦 External skills to install:'));
    for (const skill of result.installedSkills) {
      console.log(chalk.gray(`   clawdhub install ${skill}`));
    }
  }

  console.log(chalk.gray('\n📝 Next steps:'));
  console.log(chalk.gray('   1. Review and fill in USER.md'));
  console.log(chalk.gray('   2. Set required environment variables'));
  console.log(chalk.gray('   3. Configure clawdbot to use this agent workspace\n'));
}
