/**
 * File scanner - detects files to include in export
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import type { PorterManifest } from '../types.js';
import { DEFAULT_EXCLUDES } from '../types.js';

export interface ScanResult {
  files: string[];
  totalSize: number;
  warnings: string[];
}

/**
 * Scan workspace and collect files to export based on manifest
 */
export async function scanWorkspace(
  workspacePath: string,
  manifest: PorterManifest
): Promise<ScanResult> {
  const files: string[] = [];
  const warnings: string[] = [];

  // Always include the manifest
  files.push('porter.yaml');

  // Add context files
  const contextFiles = Object.values(manifest.context).filter(Boolean) as string[];
  for (const file of contextFiles) {
    const fullPath = path.join(workspacePath, file);
    if (await fs.pathExists(fullPath)) {
      files.push(file);
    } else {
      warnings.push(`Context file not found: ${file}`);
    }
  }

  // Add bundled skills
  if (manifest.skills?.bundled) {
    for (const skill of manifest.skills.bundled) {
      const skillPath = skill.path;
      const fullPath = path.join(workspacePath, skillPath);

      if (await fs.pathExists(fullPath)) {
        const skillFiles = await glob('**/*', {
          cwd: fullPath,
          nodir: true,
          dot: false,
        });

        for (const f of skillFiles) {
          files.push(path.join(skillPath, f));
        }
      } else {
        warnings.push(`Bundled skill not found: ${skillPath}`);
      }
    }
  }

  // Add assets
  if (manifest.assets) {
    for (const pattern of manifest.assets) {
      const fullPattern = path.join(workspacePath, pattern);

      // Check if it's a directory
      if (pattern.endsWith('/')) {
        const dirPath = path.join(workspacePath, pattern.slice(0, -1));
        if (await fs.pathExists(dirPath)) {
          const assetFiles = await glob('**/*', {
            cwd: dirPath,
            nodir: true,
            dot: false,
          });

          for (const f of assetFiles) {
            files.push(path.join(pattern.slice(0, -1), f));
          }
        }
      } else {
        // Glob pattern
        const matches = await glob(pattern, {
          cwd: workspacePath,
          nodir: true,
          dot: false,
        });
        files.push(...matches);
      }
    }
  }

  // Add MCP config templates
  if (manifest.mcp) {
    for (const server of manifest.mcp) {
      if (server.config) {
        const fullPath = path.join(workspacePath, server.config);
        if (await fs.pathExists(fullPath)) {
          files.push(server.config);
        } else {
          warnings.push(`MCP config template not found: ${server.config}`);
        }
      }
    }
  }

  // Add seed files
  if (manifest.seeds?.memory) {
    for (const seedPath of manifest.seeds.memory) {
      files.push(seedPath);
    }
  }

  // Filter out excludes
  const excludePatterns = [...DEFAULT_EXCLUDES, ...(manifest.exclude || [])];
  const filteredFiles = files.filter((file) => {
    return !excludePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        // Simple glob matching
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(file) || regex.test(path.basename(file));
      }
      return file.startsWith(pattern) || file === pattern;
    });
  });

  // Calculate total size
  let totalSize = 0;
  for (const file of filteredFiles) {
    try {
      const stats = await fs.stat(path.join(workspacePath, file));
      totalSize += stats.size;
    } catch {
      // File might not exist
    }
  }

  // Deduplicate
  const uniqueFiles = [...new Set(filteredFiles)];

  return {
    files: uniqueFiles,
    totalSize,
    warnings,
  };
}

/**
 * Check for potential secret leakage in files
 */
export async function checkForSecrets(
  workspacePath: string,
  files: string[]
): Promise<{ file: string; line: number; match: string }[]> {
  const leaks: { file: string; line: number; match: string }[] = [];

  // Patterns that might indicate secrets
  const secretPatterns = [
    /(?:api[_-]?key|apikey|secret|password|token|auth)[\s]*[=:]\s*["']?[a-zA-Z0-9_-]{20,}/gi,
    /sk-[a-zA-Z0-9]{32,}/g, // OpenAI-style keys
    /xai-[a-zA-Z0-9]{32,}/g, // xAI keys
    /AIza[a-zA-Z0-9_-]{35}/g, // Google API keys
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
  ];

  for (const file of files) {
    // Only check text files
    if (!/\.(md|yaml|yml|json|txt|js|ts)$/i.test(file)) {
      continue;
    }

    try {
      const content = await fs.readFile(path.join(workspacePath, file), 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of secretPatterns) {
          const matches = lines[i].match(pattern);
          if (matches) {
            leaks.push({
              file,
              line: i + 1,
              match: matches[0].slice(0, 20) + '...',
            });
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return leaks;
}
