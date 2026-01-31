/**
 * Import functionality - unpack and set up an agent
 */

import fs from 'fs-extra';
import path from 'path';
import * as tar from 'tar';
import type { PorterManifest, ImportOptions, ImportResult } from '../types.js';
import { loadManifest, validateManifest } from './manifest.js';

/**
 * Import an agent from a local archive or extracted directory
 */
export async function importAgent(
  source: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const errors: string[] = [];

  // Determine target directory
  const targetDir = options.target || process.cwd();

  // Handle different source types
  let extractedPath: string;

  if (source.endsWith('.tar.gz') || source.endsWith('.tgz')) {
    // Extract archive to temp location first
    const tempDir = path.join(targetDir, '.porter-temp');
    await fs.ensureDir(tempDir);

    try {
      await tar.extract({
        file: source,
        cwd: tempDir,
      });

      // Find the extracted directory (should be named after the agent)
      const entries = await fs.readdir(tempDir);
      if (entries.length !== 1) {
        return {
          success: false,
          errors: ['Invalid archive structure - expected single root directory'],
        };
      }

      extractedPath = path.join(tempDir, entries[0]);
    } catch (err) {
      await fs.remove(tempDir);
      return {
        success: false,
        errors: [`Failed to extract archive: ${err}`],
      };
    }
  } else if (await fs.pathExists(source)) {
    // Direct path to extracted agent
    extractedPath = source;
  } else {
    return {
      success: false,
      errors: [`Source not found: ${source}`],
    };
  }

  // Load and validate manifest
  const manifest = await loadManifest(extractedPath);
  if (!manifest) {
    return {
      success: false,
      errors: ['No porter.yaml found in package'],
    };
  }

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Check Clawdbot version compatibility (basic check)
  // In real implementation, would compare with installed version

  // Create target agent directory
  const agentDir = path.join(targetDir, manifest.name);

  if ((await fs.pathExists(agentDir)) && !options.force) {
    return {
      success: false,
      errors: [`Agent directory already exists: ${agentDir}. Use --force to overwrite.`],
    };
  }

  await fs.ensureDir(agentDir);

  // Copy all files
  const filesToCopy = await fs.readdir(extractedPath, { recursive: true, withFileTypes: true });

  for (const entry of filesToCopy) {
    if (entry.isFile()) {
      const relativePath =
        entry.parentPath === extractedPath
          ? entry.name
          : path.join(path.relative(extractedPath, entry.parentPath), entry.name);

      const srcPath = path.join(extractedPath, relativePath);
      const destPath = path.join(agentDir, relativePath);

      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(srcPath, destPath);
    }
  }

  // Handle USER.md.template
  const templatePath = path.join(agentDir, 'USER.md.template');
  const userMdPath = path.join(agentDir, 'USER.md');

  if ((await fs.pathExists(templatePath)) && !(await fs.pathExists(userMdPath))) {
    // Copy template to USER.md for user to fill in
    await fs.copy(templatePath, userMdPath);
    console.log('\n📝 Created USER.md from template - please fill in your details');
  }

  // Check for missing environment variables
  const missingEnv: string[] = [];
  if (manifest.env?.required && !options.skipEnv) {
    for (const envVar of manifest.env.required) {
      if (!process.env[envVar]) {
        missingEnv.push(envVar);
      }
    }
  }

  // Install external skills (placeholder - would use clawdhub in real implementation)
  const installedSkills: string[] = [];
  if (manifest.skills?.external && !options.skipSkills) {
    for (const skill of manifest.skills.external) {
      // Would run: clawdhub install <skill.name>
      installedSkills.push(skill.name);
      console.log(`📦 Would install skill: ${skill.name}`);
    }
  }

  // Clean up temp directory if we extracted
  const tempDir = path.join(targetDir, '.porter-temp');
  if (await fs.pathExists(tempDir)) {
    await fs.remove(tempDir);
  }

  // Run post-install hook if defined
  if (manifest.hooks?.post_install) {
    const hookPath = path.join(agentDir, manifest.hooks.post_install);
    if (await fs.pathExists(hookPath)) {
      console.log(`🔧 Running post-install hook: ${manifest.hooks.post_install}`);
      // Would execute the hook script here
    }
  }

  return {
    success: true,
    agentPath: agentDir,
    missingEnv: missingEnv.length > 0 ? missingEnv : undefined,
    installedSkills: installedSkills.length > 0 ? installedSkills : undefined,
  };
}

/**
 * Parse a source string (github:user/repo, local path, etc.)
 */
export function parseSource(source: string): {
  type: 'github' | 'local' | 'clawdhub';
  path: string;
  version?: string;
} {
  if (source.startsWith('github:')) {
    const [pathPart, version] = source.slice(7).split('@');
    return { type: 'github', path: pathPart, version };
  }

  if (source.startsWith('clawdhub:')) {
    const [pathPart, version] = source.slice(9).split('@');
    return { type: 'clawdhub', path: pathPart, version };
  }

  return { type: 'local', path: source };
}
