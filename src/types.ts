/**
 * OpenClaw Porter Types
 */

export interface PorterManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  repository?: string;
  license?: string;

  engine: {
    clawdbot: string;
    node?: string;
  };

  context: {
    soul: string;
    identity?: string;
    tools?: string;
    agents?: string;
    heartbeat?: string;
  };

  skills?: {
    bundled?: Array<{ path: string }>;
    external?: Array<{ name: string; version?: string }>;
  };

  mcp?: Array<{
    name: string;
    config?: string;
    required?: boolean;
  }>;

  env?: {
    required?: string[];
    optional?: string[];
  };

  assets?: string[];
  exclude?: string[];

  seeds?: {
    memory?: string[];
    projects?: string[];
  };

  hooks?: {
    pre_export?: string;
    post_install?: string;
    validate?: string;
  };

  tags?: string[];
}

export interface CrewManifest {
  name: string;
  version: string;
  description?: string;

  agents: Array<{
    name: string;
    role?: string;
    source: string;
  }>;

  shared?: {
    env?: string[];
    mcp?: string[];
  };
}

export interface ExportOptions {
  output?: string;
  github?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface ImportOptions {
  target?: string;
  skipEnv?: boolean;
  skipSkills?: boolean;
  force?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  files: string[];
  errors?: string[];
}

export interface ImportResult {
  success: boolean;
  agentPath?: string;
  missingEnv?: string[];
  installedSkills?: string[];
  errors?: string[];
}

// Default patterns to always exclude
export const DEFAULT_EXCLUDES = [
  '.env',
  '.env.*',
  '*.secret',
  'memory/',
  '*.log',
  '.git/',
  'node_modules/',
  '.DS_Store',
  'USER.md', // Never export user-specific file
];

// Context file mapping
export const CONTEXT_FILES = {
  soul: 'SOUL.md',
  identity: 'IDENTITY.md',
  tools: 'TOOLS.md',
  agents: 'AGENTS.md',
  heartbeat: 'HEARTBEAT.md',
} as const;
