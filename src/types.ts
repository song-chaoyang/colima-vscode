import * as vscode from 'vscode';

// Shared types used across the extension

export type ColimaRuntime = 'docker' | 'containerd' | 'incus';
export type ColimaVmType = 'qemu' | 'vz' | 'krunkit';
export type ColimaArch = 'aarch64' | 'x86_64' | 'host';
export type ColimaMountType = 'virtiofs' | '9p' | 'sshfs';
export type ColimaStatus = 'Running' | 'Stopped' | 'Broken' | 'Unknown';

export interface ColimaProfile {
  name: string;
  status: ColimaStatus;
  arch: string;
  cpus: number;
  memory: number; // bytes
  disk: number; // bytes
  runtime: string;
  address?: string;
}

export interface ColimaStatusInfo {
  displayName: string;
  driver: string;
  arch: string;
  runtime: string;
  mountType: string;
  dockerSocket?: string;
  containerdSocket?: string;
  kubernetes: boolean;
  cpu: number;
  memory: number; // bytes
  disk: number; // bytes
}

export interface ColimaVersion {
  version: string;
  commit: string;
  runtime: string;
  arch: string;
  client?: string;
  server?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string[];
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created: string;
}

export interface StartOptions {
  profile?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  runtime?: ColimaRuntime;
  vmType?: ColimaVmType;
  arch?: ColimaArch;
  kubernetes?: boolean;
  kubernetesVersion?: string;
  mountType?: ColimaMountType;
  networkAddress?: boolean;
  dns?: string[];
  env?: Record<string, string>;
  activate?: boolean;
  sshAgent?: boolean;
  foreground?: boolean;
  edit?: boolean;
  k3sArg?: string[];
  rootDisk?: number;
  hostname?: string;
  networkMode?: 'shared' | 'bridged';
  networkInterface?: string;
  modelRunner?: string;
  mounts?: MountConfig[];
  provision?: ProvisionConfig[];
}

export interface MountConfig {
  location: string;
  writable: boolean;
}

export interface ProvisionConfig {
  mode: 'system' | 'user' | 'after-boot' | 'ready';
  script: string;
}

export interface ColimaConfig {
  cpu: number;
  memory: number;
  disk: number;
  arch: string;
  runtime: string;
  modelRunner?: string;
  hostname?: string;
  kubernetes: {
    enabled: boolean;
    version: string;
    k3sArgs: string[];
    port: number;
  };
  autoActivate: boolean;
  network: {
    address: boolean;
    mode: string;
    interface: string;
    preferredRoute: boolean;
    dns: string[] | null;
    dnsHosts: Record<string, string>;
    hostAddresses: boolean;
    gatewayAddress: string;
  };
  forwardAgent: boolean;
  docker: Record<string, unknown>;
  vmType: string;
  portForwarder: string;
  rosetta: boolean;
  binfmt: boolean;
  nestedVirtualization: boolean;
  mountType: string;
  mountInotify: boolean;
  cpuType: string;
  provision: ProvisionConfig[] | null;
  sshConfig: boolean;
  sshPort: number;
  mounts: MountConfig[];
  diskImage: string;
  forceDiskImage: boolean;
  rootDisk: number;
  env: Record<string, string>;
}

export interface TreeItemContextValue {
  profile: string;
}

export class ColimaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = 'ColimaError';
  }
}

export interface DisposableLike {
  dispose(): void;
}

// Tree item types for context values
export const TreeContextValue = {
  PROFILE_RUNNING: 'profile-running',
  PROFILE_STOPPED: 'profile-stopped',
  PROFILE_BROKEN: 'profile-broken',
  CONTAINER_RUNNING: 'container-running',
  CONTAINER_STOPPED: 'container-stopped',
  K8S_POD: 'k8s-pod',
  K8S_NAMESPACE: 'k8s-namespace',
  MODEL_ITEM: 'model-item',
  MODEL_NONE: 'model-none',
} as const;

// Simple event emitter for state changes
export class EventEmitter<T> implements vscode.Disposable {
  private listeners: ((e: T) => void)[] = [];
  private disposables: vscode.Disposable[] = [];

  readonly event: vscode.Event<T> = (listener, thisArgs?, disposables?) => {
    const wrapped = thisArgs ? (e: T) => listener.call(thisArgs, e) : listener;
    this.listeners.push(wrapped);
    if (disposables) {
      disposables.push(new vscode.Disposable(() => {
        this.listeners = this.listeners.filter((l) => l !== wrapped);
      }));
    }
    return new vscode.Disposable(() => {
      this.listeners = this.listeners.filter((l) => l !== wrapped);
    });
  };

  fire(data: T): void {
    this.listeners.forEach((l) => {
      try {
        l(data);
      } catch (e) {
        console.error('[Colima] Event listener error:', e);
      }
    });
  }

  dispose(): void {
    this.listeners = [];
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
