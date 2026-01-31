/**
 * GitHub integration - fetch repos for import
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface GitHubSource {
  owner: string;
  repo: string;
  version?: string;
}

/**
 * Parse a GitHub source string into components
 * Format: github:owner/repo or github:owner/repo@v1.2.0
 */
export function parseGitHubSource(source: string): GitHubSource | null {
  if (!source.startsWith('github:')) {
    return null;
  }

  const path = source.slice(7); // Remove 'github:'
  const [repoPath, version] = path.split('@');
  const [owner, repo] = repoPath.split('/');

  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    version: version || undefined,
  };
}

/**
 * Fetch a GitHub repo to a local directory
 */
export async function fetchGitHubRepo(
  source: GitHubSource,
  targetDir: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const repoUrl = `https://github.com/${source.owner}/${source.repo}`;
  const cloneDir = path.join(targetDir, '.porter-github-temp', source.repo);

  try {
    // Clean up any existing temp directory
    await fs.remove(path.join(targetDir, '.porter-github-temp'));
    await fs.ensureDir(path.dirname(cloneDir));

    // Clone the repo
    console.log(`📥 Cloning ${source.owner}/${source.repo}...`);
    
    if (source.version) {
      // Clone specific tag/version
      await execAsync(
        `git clone --depth 1 --branch ${source.version} ${repoUrl} ${cloneDir}`,
        { timeout: 60000 }
      );
    } else {
      // Clone default branch
      await execAsync(
        `git clone --depth 1 ${repoUrl} ${cloneDir}`,
        { timeout: 60000 }
      );
    }

    // Remove .git directory to clean up
    await fs.remove(path.join(cloneDir, '.git'));

    return {
      success: true,
      path: cloneDir,
    };
  } catch (error: any) {
    // Check for common errors
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return {
        success: false,
        error: `Repository not found: ${repoUrl}`,
      };
    }

    if (error.message?.includes('could not find remote branch') || 
        error.message?.includes('did not match any')) {
      return {
        success: false,
        error: `Version not found: ${source.version}. Check available tags with: gh release list -R ${source.owner}/${source.repo}`,
      };
    }

    return {
      success: false,
      error: `Failed to clone: ${error.message}`,
    };
  }
}

/**
 * Clean up temporary GitHub clone directory
 */
export async function cleanupGitHubTemp(targetDir: string): Promise<void> {
  await fs.remove(path.join(targetDir, '.porter-github-temp'));
}
