// Centralized command IDs, view IDs, config keys, and icon paths

export const CMD = {
  // Core commands
  START: 'colima.start',
  START_QUICK: 'colima.start.quick',
  START_PRESET_DEV: 'colima.start.preset.dev',
  START_PRESET_K8S: 'colima.start.preset.k8s',
  START_PRESET_CONTAINERD: 'colima.start.preset.containerd',
  START_PRESET_AI: 'colima.start.preset.ai',
  STOP: 'colima.stop',
  RESTART: 'colima.restart',
  DELETE: 'colima.delete',
  STATUS: 'colima.status',
  SSH: 'colima.ssh',
  SSH_CONFIG: 'colima.sshConfig',

  // Profile commands
  PROFILE_CREATE: 'colima.profile.create',
  PROFILE_SWITCH: 'colima.profile.switch',
  PROFILE_START: 'colima.profile.start',
  PROFILE_STOP: 'colima.profile.stop',
  PROFILE_RESTART: 'colima.profile.restart',
  PROFILE_DELETE: 'colima.profile.delete',
  PROFILE_SSH: 'colima.profile.ssh',
  PROFILE_STATUS: 'colima.profile.status',
  PROFILE_CONFIG_EDIT: 'colima.profile.configEdit',
  PROFILE_CONFIG_VISUAL_EDIT: 'colima.profile.configVisualEdit',

  // Config commands
  CONFIG_EDIT: 'colima.config.edit',
  CONFIG_EDIT_TEMPLATE: 'colima.config.editTemplate',

  // Kubernetes commands
  K8S_START: 'colima.kubernetes.start',
  K8S_STOP: 'colima.kubernetes.stop',
  K8S_RESET: 'colima.kubernetes.reset',
  K8S_DELETE: 'colima.kubernetes.delete',

  // Model commands
  MODEL_LIST: 'colima.model.list',
  MODEL_PULL: 'colima.model.pull',
  MODEL_RUN: 'colima.model.run',
  MODEL_SERVE: 'colima.model.serve',
  MODEL_SETUP: 'colima.model.setup',

  // Container commands
  CONTAINER_STOP: 'colima.container.stop',
  CONTAINER_RESTART: 'colima.container.restart',
  CONTAINER_REMOVE: 'colima.container.remove',
  CONTAINER_LOGS: 'colima.container.logs',
  CONTAINER_EXEC: 'colima.container.exec',
  CONTAINER_INSPECT: 'colima.container.inspect',

  // Utility
  UPDATE: 'colima.update',
  PRUNE: 'colima.prune',
  OPEN_TERMINAL: 'colima.openTerminal',
  REFRESH: 'colima.refresh',
  OPEN_DOCKER_CONTEXT: 'colima.openDockerContext',
} as const;

export const VIEW = {
  PROFILES: 'colima.profiles',
  CONTAINERS: 'colima.containers',
  KUBERNETES: 'colima.kubernetes',
  MODELS: 'colima.models',
} as const;

export const CONFIG_KEY = {
  COLIMA_PATH: 'colima.colimaPath',
  AUTO_REFRESH: 'colima.autoRefresh',
  REFRESH_INTERVAL: 'colima.refreshInterval',
  DEFAULT_PROFILE: 'colima.defaultProfile',
  SHOW_STATUS_BAR: 'colima.showStatusBarItem',
  VERBOSE_LOGGING: 'colima.verboseLogging',
} as const;

export const EXTENSION_ID = 'colima';
export const OUTPUT_CHANNEL_NAME = 'Colima';
export const STATUS_BAR_PRIORITY = 100;

// Default presets for quick-start
// runtime: 'auto' means detect at runtime — use docker if available, else containerd
export const PRESETS = {
  quick: { cpu: 2, memory: 2, disk: 100, runtime: 'auto' as const, kubernetes: false },
  dev: { cpu: 4, memory: 8, disk: 100, runtime: 'auto' as const, kubernetes: false },
  k8s: { cpu: 4, memory: 8, disk: 100, runtime: 'auto' as const, kubernetes: true },
  containerd: { cpu: 2, memory: 2, disk: 100, runtime: 'containerd' as const, kubernetes: false },
  ai: { cpu: 4, memory: 8, disk: 100, runtime: 'auto' as const, kubernetes: false, vmType: 'vz' as const },
} as const;
