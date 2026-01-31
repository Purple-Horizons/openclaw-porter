/**
 * GitHub integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseGitHubSource, fetchGitHubRepo, cleanupGitHubTemp } from './github.js';

describe('github', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-github-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('parseGitHubSource', () => {
    it('should parse basic github source', () => {
      const result = parseGitHubSource('github:owner/repo');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        version: undefined,
      });
    });

    it('should parse github source with version', () => {
      const result = parseGitHubSource('github:owner/repo@v1.2.0');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        version: 'v1.2.0',
      });
    });

    it('should return null for non-github source', () => {
      const result = parseGitHubSource('./local/path');
      expect(result).toBeNull();
    });

    it('should return null for invalid github source', () => {
      const result = parseGitHubSource('github:invalid');
      expect(result).toBeNull();
    });
  });

  describe('fetchGitHubRepo', () => {
    it('should fetch a public repo', async () => {
      // Use a small, stable public repo for testing
      const result = await fetchGitHubRepo(
        { owner: 'Purple-Horizons', repo: 'openclaw-porter' },
        tempDir
      );

      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
      
      // Check that files were cloned
      const files = await fs.readdir(result.path!);
      expect(files).toContain('package.json');
      expect(files).toContain('README.md');
    }, 30000); // 30s timeout for network

    it('should fail for non-existent repo', async () => {
      const result = await fetchGitHubRepo(
        { owner: 'nonexistent-user-12345', repo: 'nonexistent-repo-67890' },
        tempDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    }, 30000);
  });

  describe('cleanupGitHubTemp', () => {
    it('should remove temp directory', async () => {
      const tempGithubDir = path.join(tempDir, '.porter-github-temp');
      await fs.ensureDir(tempGithubDir);
      await fs.writeFile(path.join(tempGithubDir, 'test.txt'), 'test');

      await cleanupGitHubTemp(tempDir);

      expect(await fs.pathExists(tempGithubDir)).toBe(false);
    });

    it('should not fail if temp directory does not exist', async () => {
      await expect(cleanupGitHubTemp(tempDir)).resolves.not.toThrow();
    });
  });
});
