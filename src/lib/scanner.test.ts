/**
 * Scanner tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { scanWorkspace, checkForSecrets } from './scanner.js';
import type { PorterManifest } from '../types.js';

describe('scanner', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('scanWorkspace', () => {
    it('should scan context files', async () => {
      // Create workspace files
      await fs.writeFile(path.join(tempDir, 'porter.yaml'), 'name: test');
      await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');
      await fs.writeFile(path.join(tempDir, 'IDENTITY.md'), '# Identity');

      const manifest: PorterManifest = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        engine: { clawdbot: '>=1.0.0' },
        context: {
          soul: 'SOUL.md',
          identity: 'IDENTITY.md',
        },
      };

      const result = await scanWorkspace(tempDir, manifest);

      expect(result.files).toContain('porter.yaml');
      expect(result.files).toContain('SOUL.md');
      expect(result.files).toContain('IDENTITY.md');
    });

    it('should warn about missing files', async () => {
      await fs.writeFile(path.join(tempDir, 'porter.yaml'), 'name: test');
      await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');

      const manifest: PorterManifest = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        engine: { clawdbot: '>=1.0.0' },
        context: {
          soul: 'SOUL.md',
          identity: 'MISSING.md',
        },
      };

      const result = await scanWorkspace(tempDir, manifest);

      expect(result.warnings.some((w) => w.includes('MISSING.md'))).toBe(true);
    });

    it('should exclude default patterns', async () => {
      await fs.writeFile(path.join(tempDir, 'porter.yaml'), 'name: test');
      await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET=value');
      await fs.ensureDir(path.join(tempDir, 'memory'));
      await fs.writeFile(path.join(tempDir, 'memory/notes.md'), 'notes');

      const manifest: PorterManifest = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
        assets: ['.env', 'memory/'], // Try to include excluded files
      };

      const result = await scanWorkspace(tempDir, manifest);

      expect(result.files).not.toContain('.env');
      expect(result.files.some((f) => f.startsWith('memory/'))).toBe(false);
    });

    it('should scan asset directories', async () => {
      await fs.writeFile(path.join(tempDir, 'porter.yaml'), 'name: test');
      await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');
      await fs.ensureDir(path.join(tempDir, 'avatars'));
      await fs.writeFile(path.join(tempDir, 'avatars/avatar.png'), 'png data');

      const manifest: PorterManifest = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
        assets: ['avatars/'],
      };

      const result = await scanWorkspace(tempDir, manifest);

      expect(result.files).toContain('avatars/avatar.png');
    });

    it('should scan bundled skills', async () => {
      await fs.writeFile(path.join(tempDir, 'porter.yaml'), 'name: test');
      await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');
      await fs.ensureDir(path.join(tempDir, 'skills/my-skill'));
      await fs.writeFile(path.join(tempDir, 'skills/my-skill/SKILL.md'), '# Skill');
      await fs.writeFile(path.join(tempDir, 'skills/my-skill/script.py'), 'code');

      const manifest: PorterManifest = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        engine: { clawdbot: '>=1.0.0' },
        context: { soul: 'SOUL.md' },
        skills: {
          bundled: [{ path: 'skills/my-skill' }],
        },
      };

      const result = await scanWorkspace(tempDir, manifest);

      expect(result.files).toContain('skills/my-skill/SKILL.md');
      expect(result.files).toContain('skills/my-skill/script.py');
    });
  });

  describe('checkForSecrets', () => {
    it('should detect API keys', async () => {
      const content = `
# Config
API_KEY = "sk-abcdefghijklmnopqrstuvwxyz123456"
`;
      await fs.writeFile(path.join(tempDir, 'config.md'), content);

      const leaks = await checkForSecrets(tempDir, ['config.md']);

      expect(leaks.length).toBeGreaterThan(0);
      expect(leaks[0].file).toBe('config.md');
    });

    it('should detect GitHub tokens', async () => {
      const content = `
token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
`;
      await fs.writeFile(path.join(tempDir, 'config.yaml'), content);

      const leaks = await checkForSecrets(tempDir, ['config.yaml']);

      expect(leaks.length).toBeGreaterThan(0);
    });

    it('should pass clean files', async () => {
      const content = `
# Configuration
Set your API_KEY in .env file
`;
      await fs.writeFile(path.join(tempDir, 'README.md'), content);

      const leaks = await checkForSecrets(tempDir, ['README.md']);

      expect(leaks.length).toBe(0);
    });
  });
});
