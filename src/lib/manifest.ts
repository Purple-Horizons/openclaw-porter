/**
 * Manifest parsing and validation
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import type { PorterManifest, ValidationResult } from '../types.js';

const MANIFEST_FILENAME = 'porter.yaml';

/**
 * Load and parse a porter.yaml manifest
 */
export async function loadManifest(workspacePath: string): Promise<PorterManifest | null> {
  const manifestPath = path.join(workspacePath, MANIFEST_FILENAME);

  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  const content = await fs.readFile(manifestPath, 'utf-8');
  const manifest = yaml.load(content) as PorterManifest;

  return manifest;
}

/**
 * Save a manifest to disk
 */
export async function saveManifest(workspacePath: string, manifest: PorterManifest): Promise<void> {
  const manifestPath = path.join(workspacePath, MANIFEST_FILENAME);
  const content = yaml.dump(manifest, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  await fs.writeFile(manifestPath, content, 'utf-8');
}

/**
 * Validate a manifest for completeness and correctness
 */
export function validateManifest(manifest: PorterManifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!manifest.name) {
    errors.push('Missing required field: name');
  } else if (!/^[a-z0-9-]+$/.test(manifest.name)) {
    errors.push('Name must be lowercase alphanumeric with hyphens only');
  }

  if (!manifest.version) {
    errors.push('Missing required field: version');
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    warnings.push('Version should follow semver (e.g., 1.0.0)');
  }

  if (!manifest.description) {
    errors.push('Missing required field: description');
  }

  // Engine requirements
  if (!manifest.engine?.clawdbot) {
    errors.push('Missing required field: engine.clawdbot');
  }

  // Context files
  if (!manifest.context?.soul) {
    errors.push('Missing required field: context.soul (SOUL.md is required)');
  }

  // Validate paths don't escape workspace
  const allPaths = [
    manifest.context?.soul,
    manifest.context?.identity,
    manifest.context?.tools,
    manifest.context?.agents,
    manifest.context?.heartbeat,
    ...(manifest.assets || []),
    ...(manifest.skills?.bundled?.map((s) => s.path) || []),
  ].filter(Boolean) as string[];

  for (const p of allPaths) {
    if (p.startsWith('/') || p.includes('..')) {
      errors.push(`Invalid path (must be relative, no ..): ${p}`);
    }
  }

  // Warn about common issues
  if (!manifest.env?.required?.length && !manifest.env?.optional?.length) {
    warnings.push('No environment variables declared - agent may not work without API keys');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate a minimal manifest from detected files
 */
export async function generateManifest(
  workspacePath: string,
  options: { name?: string; description?: string } = {}
): Promise<PorterManifest> {
  const dirName = path.basename(workspacePath);

  const manifest: PorterManifest = {
    name: options.name || dirName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: '1.0.0',
    description: options.description || `AI agent: ${dirName}`,
    engine: {
      clawdbot: '>=1.0.0',
    },
    context: {
      soul: 'SOUL.md',
    },
  };

  // Detect existing context files
  const contextFiles = ['IDENTITY.md', 'TOOLS.md', 'AGENTS.md', 'HEARTBEAT.md'];
  for (const file of contextFiles) {
    if (await fs.pathExists(path.join(workspacePath, file))) {
      const key = file.replace('.md', '').toLowerCase() as keyof typeof manifest.context;
      manifest.context[key] = file;
    }
  }

  // Detect assets
  if (await fs.pathExists(path.join(workspacePath, 'avatars'))) {
    manifest.assets = ['avatars/'];
  }

  // Detect skills
  const skillsPath = path.join(workspacePath, 'skills');
  if (await fs.pathExists(skillsPath)) {
    const entries = await fs.readdir(skillsPath, { withFileTypes: true });
    const skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    if (skillDirs.length > 0) {
      manifest.skills = {
        bundled: skillDirs.map((name) => ({ path: `skills/${name}` })),
      };
    }
  }

  return manifest;
}
