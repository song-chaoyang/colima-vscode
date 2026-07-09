import * as fs from 'fs';
import * as path from 'path';
import { getColimaHome } from '../utils/commandRunner';
import { logger } from '../utils/logger';
import type { ColimaConfig } from '../types';

/**
 * Manages Colima YAML configuration files.
 * Reads, writes, and validates colima.yaml for profiles.
 */
export class ColimaConfigManager {
  /** Get the config file path for a profile */
  getConfigPath(profile: string): string {
    return path.join(getColimaHome(), profile, 'colima.yaml');
  }

  /** Get the template file path */
  getTemplatePath(): string {
    return path.join(getColimaHome(), '_templates', 'default.yaml');
  }

  /** Check if a config file exists for a profile */
  configExists(profile: string): boolean {
    return fs.existsSync(this.getConfigPath(profile));
  }

  /** Load a profile's configuration */
  loadConfig(profile: string): ColimaConfig | null {
    const configPath = this.getConfigPath(profile);
    if (!fs.existsSync(configPath)) {
      logger.warn(`Config file not found: ${configPath}`);
      return null;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return this.parseConfig(content);
  }

  /** Save a profile's configuration */
  saveConfig(profile: string, config: ColimaConfig): void {
    const configPath = this.getConfigPath(profile);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const yaml = this.stringifyConfig(config);
    fs.writeFileSync(configPath, yaml, 'utf-8');
    logger.info(`Saved config for profile "${profile}" to ${configPath}`);
  }

  /** Parse a YAML string into a ColimaConfig */
  parseConfig(yaml: string): ColimaConfig {
    // Minimal YAML parser for colima.yaml structure
    const config = this.getDefaultConfig();
    const lines = yaml.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      // Top-level key
      const topMatch = trimmed.match(/^([\w]+):\s*(.*)$/);
      if (topMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
        const key = topMatch[1];
        const value = topMatch[2].trim();

        if (value === '' || value === 'null') {
          // Section or null value
          // section key tracked for future use
          if (key === 'kubernetes' || key === 'network') {
            // Parse nested section
            i = this.parseSection(lines, i + 1, config, key);
            continue;
          }
          if (value === 'null') {
            this.setConfigValue(config, key, null);
          }
        } else {
          // Simple value
          this.setConfigValue(config, key, this.parseValue(value));
        }
        // reset section tracking
      } else if (line.startsWith('  ')) {
        // Nested value under currentSection
        // Will be handled by parseSection for known sections
      }

      i++;
    }

    return config;
  }

  private parseSection(
    lines: string[],
    startIndex: number,
    config: ColimaConfig,
    section: string,
  ): number {
    let i = startIndex;
    const indent = '  ';

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) {
        i++;
        continue;
      }

      // If we're back to top-level, stop
      if (!line.startsWith(indent)) {
        break;
      }

      const trimmed = line.trim();
      const match = trimmed.match(/^([\w]+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();

        if (section === 'kubernetes') {
          if (key === 'enabled') config.kubernetes.enabled = value === 'true';
          else if (key === 'version') config.kubernetes.version = value.replace(/['"]/g, '');
          else if (key === 'k3sArgs') {
            config.kubernetes.k3sArgs = [];
            // Parse list items
            i++;
            while (i < lines.length && lines[i].trim().startsWith('-')) {
              const item = lines[i].trim().replace(/^-\s*/, '').replace(/['"]/g, '');
              config.kubernetes.k3sArgs.push(item);
              i++;
            }
            continue;
          } else if (key === 'port') config.kubernetes.port = parseInt(value, 10) || 0;
        } else if (section === 'network') {
          if (key === 'address') config.network.address = value === 'true';
          else if (key === 'mode') config.network.mode = value.replace(/['"]/g, '');
          else if (key === 'interface') config.network.interface = value.replace(/['"]/g, '');
          else if (key === 'preferredRoute') config.network.preferredRoute = value === 'true';
          else if (key === 'dns') {
            if (value === 'null' || value === '[]') {
              config.network.dns = null;
            } else {
              config.network.dns = [];
              if (value.startsWith('[')) {
                // Inline list
                const items = value.slice(1, -1).split(',').map((s) => s.trim().replace(/['"]/g, ''));
                config.network.dns = items.filter(Boolean);
              } else {
                // Multiline list
                i++;
                while (i < lines.length && lines[i].trim().startsWith('-')) {
                  config.network.dns.push(lines[i].trim().replace(/^-\s*/, '').replace(/['"]/g, ''));
                  i++;
                }
                continue;
              }
            }
          } else if (key === 'dnsHosts') {
            config.network.dnsHosts = {};
            i++;
            while (i < lines.length && lines[i].trim().startsWith('-')) {
              const item = lines[i].trim().replace(/^-\s*/, '');
              const [k, v] = item.split(':').map((s) => s.trim().replace(/['"]/g, ''));
              if (k && v) config.network.dnsHosts[k] = v;
              i++;
            }
            continue;
          } else if (key === 'hostAddresses') config.network.hostAddresses = value === 'true';
          else if (key === 'gatewayAddress') config.network.gatewayAddress = value.replace(/['"]/g, '');
        }
      }

      i++;
    }

    return i;
  }

  private setConfigValue(config: ColimaConfig, key: string, value: unknown): void {
    switch (key) {
      case 'cpu': config.cpu = value as number; break;
      case 'memory': config.memory = value as number; break;
      case 'disk': config.disk = value as number; break;
      case 'arch': config.arch = value as string; break;
      case 'runtime': config.runtime = value as string; break;
      case 'modelRunner': config.modelRunner = value as string; break;
      case 'hostname': config.hostname = value as string; break;
      case 'autoActivate': config.autoActivate = value as boolean; break;
      case 'forwardAgent': config.forwardAgent = value as boolean; break;
      case 'vmType': config.vmType = value as string; break;
      case 'portForwarder': config.portForwarder = value as string; break;
      case 'rosetta': config.rosetta = value as boolean; break;
      case 'binfmt': config.binfmt = value as boolean; break;
      case 'nestedVirtualization': config.nestedVirtualization = value as boolean; break;
      case 'mountType': config.mountType = value as string; break;
      case 'mountInotify': config.mountInotify = value as boolean; break;
      case 'cpuType': config.cpuType = value as string; break;
      case 'sshConfig': config.sshConfig = value as boolean; break;
      case 'sshPort': config.sshPort = value as number; break;
      case 'diskImage': config.diskImage = value as string; break;
      case 'forceDiskImage': config.forceDiskImage = value as boolean; break;
      case 'rootDisk': config.rootDisk = value as number; break;
    }
  }

  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    return value.replace(/['"]/g, '');
  }

  /** Convert a ColimaConfig to YAML string */
  stringifyConfig(config: ColimaConfig): string {
    const lines: string[] = [];

    lines.push('# Number of CPUs to be allocated to the virtual machine.');
    lines.push(`cpu: ${config.cpu}`);
    lines.push('');
    lines.push('# Size of the disk in GiB to be allocated to the virtual machine for container data.');
    lines.push(`disk: ${config.disk}`);
    lines.push('');
    lines.push('# Size of the memory in GiB to be allocated to the virtual machine.');
    lines.push(`memory: ${config.memory}`);
    lines.push('');
    lines.push('# Architecture of the virtual machine (x86_64, aarch64, host).');
    lines.push(`arch: ${config.arch}`);
    lines.push('');
    lines.push('# Container runtime to be used (docker, containerd).');
    lines.push(`runtime: ${config.runtime}`);
    lines.push('');
    lines.push('kubernetes:');
    lines.push(`  enabled: ${config.kubernetes.enabled}`);
    lines.push(`  version: ${config.kubernetes.version}`);
    if (config.kubernetes.k3sArgs.length > 0) {
      lines.push('  k3sArgs:');
      for (const arg of config.kubernetes.k3sArgs) {
        lines.push(`    - ${arg}`);
      }
    } else {
      lines.push('  k3sArgs: []');
    }
    lines.push(`  port: ${config.kubernetes.port}`);
    lines.push('');
    lines.push(`autoActivate: ${config.autoActivate}`);
    lines.push('');
    lines.push('network:');
    lines.push(`  address: ${config.network.address}`);
    lines.push(`  mode: ${config.network.mode}`);
    lines.push(`  interface: ${config.network.interface}`);
    lines.push(`  preferredRoute: ${config.network.preferredRoute}`);
    lines.push(`  dns: ${config.network.dns ? JSON.stringify(config.network.dns) : 'null'}`);
    lines.push(`  dnsHosts: {}`);
    lines.push(`  hostAddresses: ${config.network.hostAddresses}`);
    lines.push(`  gatewayAddress: ${config.network.gatewayAddress}`);
    lines.push('');
    lines.push(`forwardAgent: ${config.forwardAgent}`);
    lines.push(`docker: {}`);
    lines.push(`vmType: ${config.vmType}`);
    lines.push(`portForwarder: ${config.portForwarder}`);
    lines.push(`rosetta: ${config.rosetta}`);
    lines.push(`binfmt: ${config.binfmt}`);
    lines.push(`nestedVirtualization: ${config.nestedVirtualization}`);
    lines.push(`mountType: ${config.mountType}`);
    lines.push(`mountInotify: ${config.mountInotify}`);
    lines.push(`cpuType: "${config.cpuType}"`);
    lines.push(`sshConfig: ${config.sshConfig}`);
    lines.push(`sshPort: ${config.sshPort}`);
    lines.push(`mounts: []`);
    lines.push(`diskImage: "${config.diskImage}"`);
    lines.push(`forceDiskImage: ${config.forceDiskImage}`);
    lines.push(`rootDisk: ${config.rootDisk}`);
    lines.push(`env: {}`);

    return lines.join('\n') + '\n';
  }

  /** Get default configuration */
  getDefaultConfig(): ColimaConfig {
    return {
      cpu: 2,
      memory: 2,
      disk: 100,
      arch: 'host',
      runtime: 'docker',
      modelRunner: 'docker',
      hostname: 'colima',
      kubernetes: {
        enabled: false,
        version: 'v1.35.0+k3s1',
        k3sArgs: ['--disable=traefik'],
        port: 0,
      },
      autoActivate: true,
      network: {
        address: false,
        mode: 'shared',
        interface: 'en0',
        preferredRoute: false,
        dns: null,
        dnsHosts: {},
        hostAddresses: false,
        gatewayAddress: '192.168.5.2',
      },
      forwardAgent: false,
      docker: {},
      vmType: 'vz',
      portForwarder: 'ssh',
      rosetta: false,
      binfmt: true,
      nestedVirtualization: false,
      mountType: 'virtiofs',
      mountInotify: false,
      cpuType: '',
      provision: null,
      sshConfig: true,
      sshPort: 0,
      mounts: [],
      diskImage: '',
      forceDiskImage: false,
      rootDisk: 20,
      env: {},
    };
  }

  /** Get immutable settings (cannot be changed after VM creation) */
  getImmutableKeys(): string[] {
    return ['arch', 'runtime', 'vmType', 'mountType'];
  }

  /** Check if a setting is immutable */
  isImmutable(key: string): boolean {
    return this.getImmutableKeys().includes(key);
  }
}

export const configManager = new ColimaConfigManager();
