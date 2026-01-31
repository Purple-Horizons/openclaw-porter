/**
 * Importer tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as tar from 'tar';
import { importAgent, parseSource } from './importer.js';

describe('importer', () => {
  let tempDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-test-'));
    targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-target-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    await fs.remove(targetDir);
  });

  describe('parseSource', () => {
    it('should parse GitHub sources', () => {
      const result = parseSource('github:user/repo');
      expect(result.type).toBe('github');
      expect(result.path).toBe('user/repo');
    });

    it('should parse GitHub sources with version', () => {
      const result = parseSource('github:user/repo@v1.2.0');
      expect(result.type).toBe('github');
      expect(result.path).toBe('user/repo');
      expect(result.version).toBe('v1.2.0');
    });

    it('should parse ClawdHub sources', () => {
      const result = parseSource('clawdhub:my-agent');
      expect(result.type).toBe('clawdhub');
      expect(result.path).toBe('my-agent');
    });

    it('should parse local paths', () => {
      const result = parseSource('./my-agent.tar.gz');
      expect(result.type).toBe('local');
      expect(result.path).toBe('./my-agent.tar.gz');
    });
  });

  describe('importAgent', () => {
    it('should import from a directory', async () => {
      // Create source agent
      const agentDir = path.join(tempDir, 'source-agent');
      await fs.ensureDir(agentDir);

      const manifest = `
name: imported-agent
version: 1.0.0
description: An imported agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
      await fs.writeFile(path.join(agentDir, 'porter.yaml'), manifest);
      await fs.writeFile(path.join(agentDir, 'SOUL.md'), '# Imported Soul');

      const result = await importAgent(agentDir, { target: targetDir });

      expect(result.success).toBe(true);
      expect(result.agentPath).toBe(path.join(targetDir, 'imported-agent'));

      // Verify files were copied
      expect(await fs.pathExists(path.join(targetDir, 'imported-agent/SOUL.md'))).toBe(true);
      expect(await fs.pathExists(path.join(targetDir, 'imported-agent/porter.yaml'))).toBe(true);
    });

    it('should import from a tarball', async () => {
      // Create and archive an agent
      const agentDir = path.join(tempDir, 'test-agent');
      await fs.ensureDir(agentDir);

      const manifest = `
name: test-agent
version: 1.0.0
description: A test agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
      await fs.writeFile(path.join(agentDir, 'porter.yaml'), manifest);
      await fs.writeFile(path.join(agentDir, 'SOUL.md'), '# Test Soul');

      // Create tarball (use cwd as the agent dir, no prefix needed)
      const archivePath = path.join(tempDir, 'test-agent.tar.gz');
      await tar.create(
        {
          gzip: true,
          file: archivePath,
          cwd: tempDir,
        },
        ['test-agent']
      );

      // Remove original directory
      await fs.remove(agentDir);

      const result = await importAgent(archivePath, { target: targetDir });

      expect(result.success).toBe(true);
      expect(await fs.pathExists(path.join(targetDir, 'test-agent/SOUL.md'))).toBe(true);
    });

    it('should fail if agent already exists without force', async () => {
      // Create source
      const agentDir = path.join(tempDir, 'source-agent');
      await fs.ensureDir(agentDir);
      await fs.writeFile(
        path.join(agentDir, 'porter.yaml'),
        'name: existing\nversion: 1.0.0\ndescription: test\nengine:\n  clawdbot: ">=1.0.0"\ncontext:\n  soul: SOUL.md'
      );
      await fs.writeFile(path.join(agentDir, 'SOUL.md'), '# Soul');

      // Create existing target
      await fs.ensureDir(path.join(targetDir, 'existing'));

      const result = await importAgent(agentDir, { target: targetDir });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('already exists'))).toBe(true);
    });

    it('should report missing env vars', async () => {
      const agentDir = path.join(tempDir, 'source-agent');
      await fs.ensureDir(agentDir);

      const manifest = `
name: env-agent
version: 1.0.0
description: Agent with env vars
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
env:
  required:
    - MISSING_VAR_12345
`;
      await fs.writeFile(path.join(agentDir, 'porter.yaml'), manifest);
      await fs.writeFile(path.join(agentDir, 'SOUL.md'), '# Soul');

      const result = await importAgent(agentDir, { target: targetDir });

      expect(result.success).toBe(true);
      expect(result.missingEnv).toContain('MISSING_VAR_12345');
    });

    it('should create USER.md from template', async () => {
      const agentDir = path.join(tempDir, 'source-agent');
      await fs.ensureDir(agentDir);

      const manifest = `
name: template-agent
version: 1.0.0
description: Agent with template
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
      await fs.writeFile(path.join(agentDir, 'porter.yaml'), manifest);
      await fs.writeFile(path.join(agentDir, 'SOUL.md'), '# Soul');
      await fs.writeFile(
        path.join(agentDir, 'USER.md.template'),
        '# USER.md\n- **Name:** {{YOUR_NAME}}'
      );

      const result = await importAgent(agentDir, { target: targetDir });

      expect(result.success).toBe(true);

      // USER.md should be created from template
      const userMdPath = path.join(targetDir, 'template-agent/USER.md');
      expect(await fs.pathExists(userMdPath)).toBe(true);
    });
  });
});
