/**
 * Manifest tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { loadManifest, saveManifest, validateManifest, generateManifest } from './manifest.js';
import type { PorterManifest } from '../types.js';

describe('manifest', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('loadManifest', () => {
    it('should return null if no manifest exists', async () => {
      const result = await loadManifest(tempDir);
      expect(result).toBeNull();
    });

    it('should load a valid manifest', async () => {
      const manifestContent = `
name: test-agent
version: 1.0.0
description: A test agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
      await fs.writeFile(path.join(tempDir, 'porter.yaml'), manifestContent);

      const result = await loadManifest(tempDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-agent');
      expect(result?.version).toBe('1.0.0');
    });
  });

  describe('saveManifest', () => {
    it('should save a manifest to disk', async () => {
      const manifest: PorterManifest = {
        name: 'test-agent',
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
      };

      await saveManifest(tempDir, manifest);

      const saved = await loadManifest(tempDir);
      expect(saved?.name).toBe('test-agent');
    });
  });

  describe('validateManifest', () => {
    it('should pass for a valid manifest', () => {
      const manifest: PorterManifest = {
        name: 'test-agent',
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
        env: { required: ['API_KEY'] },
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing name', () => {
      const manifest = {
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
      } as PorterManifest;

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    it('should fail for invalid name format', () => {
      const manifest: PorterManifest = {
        name: 'Test Agent!',
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be lowercase alphanumeric with hyphens only');
    });

    it('should fail for missing soul', () => {
      const manifest: PorterManifest = {
        name: 'test-agent',
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: {} as any,
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: context.soul (SOUL.md is required)');
    });

    it('should fail for path traversal attempts', () => {
      const manifest: PorterManifest = {
        name: 'test-agent',
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: '../../../etc/passwd' },
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid path'))).toBe(true);
    });

    it('should warn for missing env vars', () => {
      const manifest: PorterManifest = {
        name: 'test-agent',
        version: '1.0.0',
        description: 'A test agent',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
      };

      const result = validateManifest(manifest);
      expect(result.warnings.some((w) => w.includes('environment variables'))).toBe(true);
    });
  });

  describe('generateManifest', () => {
    it('should generate manifest from workspace', async () => {
      // Create a minimal workspace
      await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');
      await fs.writeFile(path.join(tempDir, 'IDENTITY.md'), '# Identity');
      await fs.ensureDir(path.join(tempDir, 'avatars'));

      const manifest = await generateManifest(tempDir, {
        name: 'my-agent',
        description: 'My test agent',
      });

      expect(manifest.name).toBe('my-agent');
      expect(manifest.description).toBe('My test agent');
      expect(manifest.context.soul).toBe('SOUL.md');
      expect(manifest.context.identity).toBe('IDENTITY.md');
      expect(manifest.assets).toContain('avatars/');
    });
  });
});
