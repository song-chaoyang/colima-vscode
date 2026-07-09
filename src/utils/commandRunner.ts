import { spawn, execSync, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ColimaError } from '../types';
import { logger } from './logger';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StreamHandlers {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

/**
 * Find the colima binary path.
 * Checks user config, PATH, and common installation locations across platforms.
 */
export function findColimaBinary(customPath?: string): string {
  if (customPath && customPath.trim()) {
    return customPath.trim();
  }

  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === 'darwin') {
    // macOS: Homebrew Apple Silicon, Homebrew Intel, user local
    candidates.push('/opt/homebrew/bin/colima');
    candidates.push('/usr/local/bin/colima');
    candidates.push(path.join(os.homedir(), '.local', 'bin', 'colima'));
  } else if (platform === 'linux') {
    // Linux: Linuxbrew, user local, /usr/local, /usr/bin
    candidates.push('/home/linuxbrew/.linuxbrew/bin/colima');
    candidates.push(path.join(os.homedir(), '.local', 'bin', 'colima'));
    candidates.push('/usr/local/bin/colima');
    candidates.push('/usr/bin/colima');
  } else if (platform === 'win32') {
    // Windows: colima may be installed via scoop, chocolatey, or WSL
    candidates.push(path.join(os.homedir(), 'scoop', 'shims', 'colima.exe'));
    candidates.push(path.join(os.homedir(), 'scoop', 'shims', 'colima'));
    candidates.push('C:\\Program Files\\colima\\colima.exe');
    candidates.push('colima'); // Rely on PATH
  }

  // On all platforms, also try just 'colima' (rely on PATH)
  candidates.push('colima');

  for (const candidate of candidates) {
    if (candidate === 'colima') {
      // For PATH-based lookup, check with which/where
      try {
        execSync(`which colima 2>/dev/null || where colima 2>NUL`, { stdio: 'pipe' });
        return 'colima';
      } catch {
        continue;
      }
    }
    try {
      fs.statSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return 'colima'; // Fallback to PATH
}

/**
 * Run a command and return stdout/stderr/exitCode.
 */
export function runCommand(
  command: string,
  args: string[],
  options: { timeout?: number; cwd?: string; env?: Record<string, string> } = {},
): Promise<CommandResult> {
  const { timeout = 60000, cwd, env } = options;
  const fullEnv = { ...process.env, ...env } as Record<string, string>;

  return new Promise((resolve, reject) => {
    logger.debug(`Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd,
      env: fullEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err: Error) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new ColimaError(`Command not found: ${command}`, 'ENOENT', stderr));
      } else {
        reject(new ColimaError(`Failed to execute ${command}: ${err.message}`, 'SPAWN_ERROR', stderr));
      }
    });

    child.on('close', (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

/**
 * Spawn a command and stream output to handlers.
 * Used for long-running commands like colima start.
 */
export function spawnCommand(
  command: string,
  args: string[],
  handlers?: StreamHandlers,
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const fullEnv = { ...process.env, ...options.env } as Record<string, string>;
    logger.debug(`Spawning: ${command} ${args.join(' ')}`);

    const child: ChildProcess = spawn(command, args, {
      cwd: options.cwd,
      env: fullEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      handlers?.onStdout?.(text);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      handlers?.onStderr?.(text);
    });

    child.on('error', (err: Error) => {
      reject(new ColimaError(
        `Failed to execute ${command}: ${err.message}`,
        'SPAWN_ERROR',
        stderr,
      ));
    });

    child.on('close', (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

/**
 * Check if a binary exists on the system.
 */
export function binaryExists(binaryPath: string): boolean {
  try {
    execSync(`which ${binaryPath}`, { stdio: 'pipe' });
    return true;
  } catch {
    try {
      fs.statSync(binaryPath);
      return true;
    } catch {
      return false;
    }
  }
}

export function getHomeDir(): string {
  return os.homedir();
}

export function getColimaHome(): string {
  return process.env.COLIMA_HOME || path.join(os.homedir(), '.colima');
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}
