/**
 * Exporter tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import tar from 'tar';
import { exportAgent } from './exporter.js';

describe('exporter', () => {
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-test-'));
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'porter-out-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    await fs.remove(outputDir);
  });

  it('should fail without manifest', async () => {
    const result = await exportAgent(tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('No porter.yaml found');
  });

  it('should export a valid agent', async () => {
    // Create workspace
    const manifest = `
name: test-agent
version: 1.0.0
description: A test agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
env:
  required:
    - API_KEY
`;
    await fs.writeFile(path.join(tempDir, 'porter.yaml'), manifest);
    await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Test Agent Soul');

    const result = await exportAgent(tempDir, { output: outputDir });

    expect(result.success).toBe(true);
    expect(result.outputPath).toContain('test-agent-1.0.0.tar.gz');
    expect(result.files).toContain('porter.yaml');
    expect(result.files).toContain('SOUL.md');

    // Verify archive exists
    expect(await fs.pathExists(result.outputPath!)).toBe(true);
  });

  it('should perform dry run without creating archive', async () => {
    const manifest = `
name: test-agent
version: 1.0.0
description: A test agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
    await fs.writeFile(path.join(tempDir, 'porter.yaml'), manifest);
    await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');

    const result = await exportAgent(tempDir, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.outputPath).toBeUndefined();
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('should block export with secrets unless forced', async () => {
    const manifest = `
name: test-agent
version: 1.0.0
description: A test agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
    await fs.writeFile(path.join(tempDir, 'porter.yaml'), manifest);
    await fs.writeFile(
      path.join(tempDir, 'SOUL.md'),
      '# Soul\nAPI_KEY = "sk-abcdefghijklmnopqrstuvwxyz123456"'
    );

    const result = await exportAgent(tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('secrets'))).toBe(true);
  });

  it('should generate USER.md.template from USER.md', async () => {
    const manifest = `
name: test-agent
version: 1.0.0
description: A test agent
engine:
  clawdbot: ">=1.0.0"
context:
  soul: SOUL.md
`;
    const userMd = `
# USER.md
- **Name:** John Doe
- **Timezone:** America/New_York
- **Location:** Miami, FL
`;
    await fs.writeFile(path.join(tempDir, 'porter.yaml'), manifest);
    await fs.writeFile(path.join(tempDir, 'SOUL.md'), '# Soul');
    await fs.writeFile(path.join(tempDir, 'USER.md'), userMd);

    const result = await exportAgent(tempDir, { output: outputDir });

    expect(result.success).toBe(true);
    expect(result.files).toContain('USER.md.template');

    // Check template was generated
    const templatePath = path.join(tempDir, 'USER.md.template');
    expect(await fs.pathExists(templatePath)).toBe(true);

    const templateContent = await fs.readFile(templatePath, 'utf-8');
    expect(templateContent).toContain('{{YOUR_NAME}}');
  });
});
