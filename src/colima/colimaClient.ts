import * as path from 'path';
import * as fs from 'fs';
import { runCommand, spawnCommand, findColimaBinary, getColimaHome } from '../utils/commandRunner';
import { logger } from '../utils/logger';
import {
  ColimaError,
  type ColimaProfile,
  type ColimaStatusInfo,
  type ColimaVersion,
  type StartOptions,
  type DockerContainer,
  type DockerImage,
} from '../types';

/**
 * Core Colima CLI client.
 */
export class ColimaClient {
  private binaryPath: string;

  constructor(customPath?: string) {
    this.binaryPath = findColimaBinary(customPath);
  }

  updatePath(customPath?: string): void {
    this.binaryPath = findColimaBinary(customPath);
  }

  getBinaryPath(): string {
    return this.binaryPath;
  }

  async isInstalled(): Promise<boolean> {
    // Try the detected binary path first
    try {
      const result = await runCommand(this.binaryPath, ['version'], { timeout: 10000 });
      if (result.exitCode === 0) return true;
    } catch { /* continue to fallbacks */ }

    // Fallback: try common absolute paths (VS Code extension host PATH may differ from terminal)
    const fallbackPaths = [
      '/opt/homebrew/bin/colima',
      '/usr/local/bin/colima',
      '/usr/bin/colima',
      '/home/linuxbrew/.linuxbrew/bin/colima',
    ];
    for (const p of fallbackPaths) {
      try {
        const result = await runCommand(p, ['version'], { timeout: 10000 });
        if (result.exitCode === 0) {
          this.binaryPath = p;
          return true;
        }
      } catch { /* try next */ }
    }

    return false;
  }

  async getVersion(): Promise<ColimaVersion> {
    const result = await runCommand(this.binaryPath, ['version']);
    if (result.exitCode !== 0) {
      throw new ColimaError('Failed to get Colima version', 'VERSION_ERROR', result.stderr);
    }

    const version: ColimaVersion = {
      version: '', commit: '', runtime: '', arch: '',
    };
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('colima version')) version.version = trimmed.replace('colima version', '').trim();
      else if (trimmed.startsWith('git commit:')) version.commit = trimmed.replace('git commit:', '').trim();
      else if (trimmed.startsWith('runtime:')) version.runtime = trimmed.replace('runtime:', '').trim();
      else if (trimmed.startsWith('arch:')) version.arch = trimmed.replace('arch:', '').trim();
      else if (trimmed.startsWith('client:')) version.client = trimmed.replace('client:', '').trim();
      else if (trimmed.startsWith('server:')) version.server = trimmed.replace('server:', '').trim();
    }
    return version;
  }

  async listProfiles(): Promise<ColimaProfile[]> {
    const result = await runCommand(this.binaryPath, ['list', '--json']);
    if (result.exitCode !== 0) {
      const textResult = await runCommand(this.binaryPath, ['list']);
      if (textResult.exitCode !== 0 && !textResult.stdout.includes('PROFILE')) return [];
      return this.parseListText(textResult.stdout);
    }
    try {
      const trimmed = result.stdout.trim();
      // colima list --json returns NDJSON (one JSON object per line) or a JSON array
      let rawData: any[];
      try {
        // Try parsing as a single JSON array first
        const parsed = JSON.parse(trimmed);
        rawData = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fall back to NDJSON parsing (one JSON object per line)
        rawData = trimmed
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('time=') && !line.includes('level='))
          .map((line) => {
            try { return JSON.parse(line); } catch { return null; }
          })
          .filter((item): item is any => item !== null);
      }
      return rawData.map((p: any) => ({
        name: p.name ?? 'default',
        status: p.status ?? 'Unknown',
        arch: p.arch ?? '',
        cpus: p.cpus ?? 0,
        memory: p.memory ?? 0,
        disk: p.disk ?? 0,
        runtime: p.runtime ?? '',
        address: p.address ?? '',
      }));
    } catch {
      return this.parseListText(result.stdout);
    }
  }

  private parseListText(text: string): ColimaProfile[] {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const profiles: ColimaProfile[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/).filter((p) => p);
      if (parts.length >= 5) {
        profiles.push({
          name: parts[0],
          status: parts[1] as ColimaProfile['status'],
          arch: parts[2],
          cpus: parseInt(parts[3], 10) || 0,
          memory: this.parseMemory(parts[4]),
          disk: parts[5] ? this.parseMemory(parts[5]) : 0,
          runtime: parts[6] ?? '',
          address: parts[7] ?? '',
        });
      }
    }
    return profiles;
  }

  private parseMemory(str: string): number {
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    const match = str.match(/^([\d.]+)\s*([KMGT]?i?B?)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers: Record<string, number> = {
      B: 1, K: 1024, KB: 1024, KIB: 1024,
      M: 1024 ** 2, MB: 1024 ** 2, MIB: 1024 ** 2,
      G: 1024 ** 3, GB: 1024 ** 3, GIB: 1024 ** 3,
      T: 1024 ** 4, TB: 1024 ** 4, TIB: 1024 ** 4,
    };
    return Math.round(value * (multipliers[unit] ?? 1));
  }

  async getStatus(profile?: string): Promise<ColimaStatusInfo> {
    const args = ['status', '--json'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args);
    if (result.exitCode !== 0) {
      throw new ColimaError(
        `Failed to get status${profile ? ` for profile "${profile}"` : ''}`,
        'STATUS_ERROR', result.stderr || result.stdout,
      );
    }
    try {
      const data = JSON.parse(result.stdout.trim());
      return {
        displayName: data.display_name ?? 'colima',
        driver: data.driver ?? 'unknown',
        arch: data.arch ?? '',
        runtime: data.runtime ?? '',
        mountType: data.mount_type ?? '',
        dockerSocket: data.docker_socket,
        containerdSocket: data.containerd_socket,
        kubernetes: data.kubernetes ?? false,
        cpu: data.cpu ?? 0,
        memory: data.memory ?? 0,
        disk: data.disk ?? 0,
      };
    } catch {
      throw new ColimaError('Failed to parse status output', 'PARSE_ERROR', result.stdout);
    }
  }

  /**
   * Start Colima. Returns the combined output (stdout+stderr) for error display.
   * Throws ColimaError with the full output if start fails.
   */
  async start(
    options: StartOptions,
    onOutput?: (data: string) => void,
  ): Promise<void> {
    const args = this.buildStartArgs(options);
    logger.info(`Starting Colima with args: ${args.join(' ')}`);

    const result = await spawnCommand(
      this.binaryPath,
      ['start', ...args],
      {
        onStdout: (data) => {
          onOutput?.(data);
          logger.debug(data.trim());
        },
        onStderr: (data) => {
          onOutput?.(data);
          logger.debug(data.trim());
        },
      },
    );

    if (result.exitCode !== 0) {
      const combinedOutput = (result.stdout + result.stderr).trim();
      // Check for "already running" — this is not really an error
      if (combinedOutput.includes('already running')) {
        logger.info('Colima is already running, ignoring start');
        return;
      }
      throw new ColimaError(
        combinedOutput || `Colima exited with code ${result.exitCode}`,
        'START_ERROR',
        combinedOutput,
      );
    }
  }

  private buildStartArgs(options: StartOptions): string[] {
    const args: string[] = [];
    if (options.profile && options.profile !== 'default') {
      args.push(options.profile);
    }
    if (options.cpu !== undefined) args.push('--cpu', String(options.cpu));
    if (options.memory !== undefined) args.push('--memory', String(options.memory));
    if (options.disk !== undefined) args.push('--disk', String(options.disk));
    if (options.runtime) args.push('--runtime', options.runtime);
    if (options.vmType) args.push('--vm-type', options.vmType);
    if (options.arch) args.push('--arch', options.arch);
    if (options.kubernetes === true) args.push('--kubernetes');
    if (options.kubernetes === false) args.push('--kubernetes=false');
    if (options.kubernetesVersion) args.push('--kubernetes-version', options.kubernetesVersion);
    if (options.mountType) args.push('--mount-type', options.mountType);
    if (options.networkAddress) args.push('--network-address');
    if (options.dns) {
      for (const dns of options.dns) args.push('--dns', dns);
    }
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('--env', `${key}=${value}`);
      }
    }
    if (options.activate === false) args.push('--activate=false');
    if (options.sshAgent) args.push('--ssh-agent');
    if (options.foreground) args.push('--foreground');
    if (options.edit) args.push('--edit');
    if (options.k3sArg) {
      for (const arg of options.k3sArg) args.push('--k3s-arg', arg);
    }
    if (options.rootDisk !== undefined) args.push('--root-disk', String(options.rootDisk));
    if (options.hostname) args.push('--hostname', options.hostname);
    if (options.networkMode) args.push('--network-mode', options.networkMode);
    if (options.networkInterface) args.push('--network-interface', options.networkInterface);
    if (options.modelRunner) args.push('--model-runner', options.modelRunner);
    return args;
  }

  async stop(profile?: string, force?: boolean): Promise<void> {
    const args = ['stop'];
    if (profile && profile !== 'default') args.push(profile);
    if (force) args.push('--force');
    const result = await runCommand(this.binaryPath, args, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'Stop failed',
        'STOP_ERROR', result.stderr,
      );
    }
  }

  async restart(profile?: string, force?: boolean): Promise<void> {
    const args = ['restart'];
    if (profile && profile !== 'default') args.push(profile);
    if (force) args.push('--force');
    const result = await runCommand(this.binaryPath, args, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'Restart failed',
        'RESTART_ERROR', result.stderr,
      );
    }
  }

  async delete(profile?: string, force?: boolean, data?: boolean): Promise<void> {
    const args = ['delete'];
    if (profile && profile !== 'default') args.push(profile);
    if (force) args.push('--force');
    if (data) args.push('--data');
    const result = await runCommand(this.binaryPath, args, { timeout: 60000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'Delete failed',
        'DELETE_ERROR', result.stderr,
      );
    }
  }

  async sshConfig(profile?: string): Promise<string> {
    const args = ['ssh-config'];
    if (profile && profile !== 'default') args.push(profile);
    const result = await runCommand(this.binaryPath, args);
    if (result.exitCode !== 0) {
      throw new ColimaError('Failed to get SSH config', 'SSH_CONFIG_ERROR', result.stderr);
    }
    return result.stdout;
  }

  async update(profile?: string): Promise<void> {
    const args = ['update'];
    if (profile && profile !== 'default') args.push(profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 300000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'Update failed',
        'UPDATE_ERROR', result.stderr,
      );
    }
  }

  async prune(all?: boolean, force?: boolean): Promise<void> {
    const args = ['prune'];
    if (all) args.push('--all');
    if (force) args.push('--force');
    const result = await runCommand(this.binaryPath, args, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'Prune failed',
        'PRUNE_ERROR', result.stderr,
      );
    }
  }

  // Kubernetes
  async kubernetesStart(profile?: string): Promise<void> {
    const args = ['kubernetes', 'start'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 300000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'K8s start failed',
        'K8S_START_ERROR', result.stderr,
      );
    }
  }

  async kubernetesStop(profile?: string): Promise<void> {
    const args = ['kubernetes', 'stop'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 60000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'K8s stop failed',
        'K8S_STOP_ERROR', result.stderr,
      );
    }
  }

  async kubernetesDelete(profile?: string): Promise<void> {
    const args = ['kubernetes', 'delete'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 60000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'K8s delete failed',
        'K8S_DELETE_ERROR', result.stderr,
      );
    }
  }

  async kubernetesReset(profile?: string): Promise<void> {
    const args = ['kubernetes', 'reset'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'K8s reset failed',
        'K8S_RESET_ERROR', result.stderr,
      );
    }
  }

  // AI Models
  async modelList(profile?: string): Promise<string[]> {
    const args = ['model', 'list'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 30000 });
    if (result.exitCode !== 0) return [];
    return result.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('time=') && !l.includes('level='));
  }

  async modelPull(model: string, profile?: string): Promise<void> {
    const args = ['model', 'pull', model];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 600000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || `Pull "${model}" failed`,
        'MODEL_PULL_ERROR', result.stderr,
      );
    }
  }

  async modelRun(model: string, profile?: string): Promise<void> {
    const args = ['model', 'run', model];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await spawnCommand(this.binaryPath, args);
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || `Run "${model}" failed`,
        'MODEL_RUN_ERROR', result.stderr,
      );
    }
  }

  async modelServe(model: string, port: number, profile?: string): Promise<void> {
    const args = ['model', 'serve', model, '--port', String(port)];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await spawnCommand(this.binaryPath, args);
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || `Serve "${model}" failed`,
        'MODEL_SERVE_ERROR', result.stderr,
      );
    }
  }

  async modelSetup(profile?: string): Promise<void> {
    const args = ['model', 'setup'];
    if (profile && profile !== 'default') args.push('-p', profile);
    const result = await runCommand(this.binaryPath, args, { timeout: 300000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(
        (result.stderr + result.stdout).trim() || 'Model setup failed',
        'MODEL_SETUP_ERROR', result.stderr,
      );
    }
  }

  // Docker integration — uses `docker context use colima` then regular docker commands

  /**
   * Ensure the colima docker context is active, then run docker commands.
   * The colima context is set up automatically when colima starts.
   */
  private async getDockerEnv(profile?: string): Promise<Record<string, string>> {
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    // Colima sets up a docker context. The socket is at ~/.colima/<profile>/docker.sock
    const socketPath = path.join(getColimaHome(), profile ?? 'default', 'docker.sock');
    if (fs.existsSync(socketPath)) {
      env.DOCKER_HOST = `unix://${socketPath}`;
    }
    return env;
  }

  async getDockerContainers(profile?: string): Promise<DockerContainer[]> {
    const env = await this.getDockerEnv(profile);
    const result = await runCommand('docker', ['ps', '-a', '--format', '{{json .}}'], { env, timeout: 15000 });
    if (result.exitCode !== 0) {
      logger.debug(`docker ps failed: ${result.stderr}`);
      return [];
    }
    const containers: DockerContainer[] = [];
    for (const line of result.stdout.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        const c = JSON.parse(line);
        containers.push({
          id: c.ID ?? c.id ?? '',
          name: c.Names ?? c.names ?? '',
          image: c.Image ?? c.image ?? '',
          status: c.Status ?? c.status ?? '',
          state: c.State ?? c.state ?? '',
          ports: this.parsePorts(c.Ports ?? c.ports ?? ''),
        });
      } catch { /* skip */ }
    }
    return containers;
  }

  async getDockerImages(profile?: string): Promise<DockerImage[]> {
    const env = await this.getDockerEnv(profile);
    const result = await runCommand('docker', ['images', '--format', '{{json .}}'], { env, timeout: 15000 });
    if (result.exitCode !== 0) return [];
    const images: DockerImage[] = [];
    for (const line of result.stdout.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        const img = JSON.parse(line);
        images.push({
          id: img.ID ?? img.id ?? '',
          repository: img.Repository ?? img.repository ?? '',
          tag: img.Tag ?? img.tag ?? '',
          size: img.Size ?? img.size ?? 0,
          created: img.CreatedSince ?? img.createdSince ?? '',
        });
      } catch { /* skip */ }
    }
    return images;
  }

  async dockerStop(containerId: string, profile?: string): Promise<void> {
    const env = await this.getDockerEnv(profile);
    const result = await runCommand('docker', ['stop', containerId], { env, timeout: 30000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(`Stop container ${containerId} failed`, 'DOCKER_STOP_ERROR', result.stderr);
    }
  }

  async dockerRestart(containerId: string, profile?: string): Promise<void> {
    const env = await this.getDockerEnv(profile);
    const result = await runCommand('docker', ['restart', containerId], { env, timeout: 30000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(`Restart container ${containerId} failed`, 'DOCKER_RESTART_ERROR', result.stderr);
    }
  }

  async dockerRemove(containerId: string, profile?: string): Promise<void> {
    const env = await this.getDockerEnv(profile);
    const result = await runCommand('docker', ['rm', '-f', containerId], { env, timeout: 30000 });
    if (result.exitCode !== 0) {
      throw new ColimaError(`Remove container ${containerId} failed`, 'DOCKER_REMOVE_ERROR', result.stderr);
    }
  }

  private parsePorts(portsStr: string): string[] {
    if (!portsStr) return [];
    return portsStr.split(',').map((p) => p.trim()).filter(Boolean);
  }

  // Kubernetes pods
  async getKubernetesPods(profile?: string): Promise<KubernetesPod[]> {
    const env = await this.getKubeEnv(profile);
    const result = await runCommand('kubectl', ['get', 'pods', '-A', '-o', 'json'], { env, timeout: 15000 });
    if (result.exitCode !== 0) return [];
    try {
      const data = JSON.parse(result.stdout);
      return (data.items ?? []).map((item: any) => ({
        name: item.metadata?.name ?? '',
        namespace: item.metadata?.namespace ?? '',
        status: item.status?.phase ?? 'Unknown',
        ready: this.getReadyContainers(item.status?.containerStatuses ?? []),
        restarts: this.getRestartCount(item.status?.containerStatuses ?? []),
        age: this.calculateAge(item.metadata?.creationTimestamp),
      }));
    } catch {
      return [];
    }
  }

  private async getKubeEnv(profile?: string): Promise<Record<string, string>> {
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    const kubeconfigPath = path.join(getColimaHome(), profile ?? 'default', 'kubeconfig.yaml');
    if (fs.existsSync(kubeconfigPath)) {
      env.KUBECONFIG = kubeconfigPath;
    }
    return env;
  }

  private getReadyContainers(statuses: any[]): string {
    return `${statuses.filter((s) => s.ready).length}/${statuses.length}`;
  }

  private getRestartCount(statuses: any[]): number {
    return statuses.reduce((sum, s) => sum + (s.restartCount ?? 0), 0);
  }

  private calculateAge(creationTimestamp?: string): string {
    if (!creationTimestamp) return 'Unknown';
    const diff = Date.now() - new Date(creationTimestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes > 1440) return `${Math.floor(minutes / 1440)}d`;
    if (minutes > 60) return `${Math.floor(minutes / 60)}h`;
    return `${minutes}m`;
  }
}

export interface KubernetesPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
}
