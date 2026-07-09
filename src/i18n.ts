import * as vscode from 'vscode';

export type Locale = 'en' | 'zh';

let currentLocale: Locale = 'en';

export function initLocale(): void {
  const lang = vscode.env.language;
  currentLocale = lang.startsWith('zh') ? 'zh' : 'en';
}

export function getLocale(): Locale {
  return currentLocale;
}

// All UI strings — English and Chinese
const messages: Record<string, Record<Locale, string>> = {
  // Extension / status bar
  'status.running': { en: 'Running', zh: '运行中' },
  'status.stopped': { en: 'Stopped', zh: '已停止' },
  'status.broken': { en: 'Broken', zh: '异常' },
  'status.error': { en: 'Error', zh: '错误' },
  'status.notInstalled': { en: 'Not Installed', zh: '未安装' },

  // Quick actions menu
  'action.start': { en: 'Start Colima', zh: '启动 Colima' },
  'action.stop': { en: 'Stop Colima', zh: '停止 Colima' },
  'action.restart': { en: 'Restart Colima', zh: '重启 Colima' },
  'action.ssh': { en: 'SSH into VM', zh: 'SSH 进入虚拟机' },
  'action.editConfig': { en: 'Edit Configuration', zh: '编辑配置' },
  'action.showStatus': { en: 'Show Status', zh: '查看状态' },
  'action.refresh': { en: 'Refresh', zh: '刷新' },
  'action.quickActions': { en: 'Colima Quick Actions', zh: 'Colima 快捷操作' },

  // Start wizard
  'wizard.title': { en: 'Colima Start Wizard', zh: 'Colima 启动向导' },
  'wizard.subtitle': { en: 'Choose a preset or configure custom settings to start Colima.', zh: '选择预设或自定义配置来启动 Colima。' },
  'wizard.profileName': { en: 'Profile Name', zh: '配置名称' },
  'wizard.quickPresets': { en: 'Quick Presets', zh: '快速预设' },
  'wizard.customConfig': { en: 'Custom Configuration', zh: '自定义配置' },
  'wizard.startColima': { en: 'Start Colima', zh: '启动 Colima' },
  'wizard.cancel': { en: 'Cancel', zh: '取消' },

  // Presets
  'preset.quick': { en: 'Quick Start', zh: '快速启动' },
  'preset.quick.desc': { en: 'Sensible defaults for most use cases', zh: '适合大多数场景的默认配置' },
  'preset.dev': { en: 'Development', zh: '开发环境' },
  'preset.dev.desc': { en: 'More resources for development work', zh: '更多资源用于开发工作' },
  'preset.k8s': { en: 'Kubernetes', zh: 'Kubernetes' },
  'preset.k8s.desc': { en: 'Docker + K3s cluster for K8s development', zh: 'Docker + K3s 集群用于 K8s 开发' },
  'preset.containerd': { en: 'Containerd', zh: 'Containerd' },
  'preset.containerd.desc': { en: 'Use containerd runtime with nerdctl', zh: '使用 containerd 运行时和 nerdctl' },
  'preset.ai': { en: 'AI Workload', zh: 'AI 工作负载' },
  'preset.ai.desc': { en: 'GPU-accelerated for running AI models', zh: 'GPU 加速运行 AI 模型' },

  // Form labels
  'label.cpu': { en: 'CPU Cores', zh: 'CPU 核心数' },
  'label.memory': { en: 'Memory (GB)', zh: '内存 (GB)' },
  'label.disk': { en: 'Disk Size (GB)', zh: '磁盘大小 (GB)' },
  'label.runtime': { en: 'Runtime', zh: '运行时' },
  'label.vmType': { en: 'VM Type', zh: '虚拟机类型' },
  'label.mountType': { en: 'Mount Type', zh: '挂载类型' },
  'label.arch': { en: 'Architecture', zh: '架构' },
  'label.kubernetes': { en: 'Enable Kubernetes (K3s)', zh: '启用 Kubernetes (K3s)' },
  'label.k8sVersion': { en: 'Kubernetes Version', zh: 'Kubernetes 版本' },
  'label.networkAddress': { en: 'Enable reachable network address', zh: '启用可达网络地址' },
  'label.sshAgent': { en: 'Forward SSH agent to VM', zh: '转发 SSH 代理到虚拟机' },
  'label.hostname': { en: 'Hostname', zh: '主机名' },
  'label.rootDisk': { en: 'Root Disk Size (GB)', zh: '根磁盘大小 (GB)' },
  'label.dns': { en: 'DNS Servers (comma-separated)', zh: 'DNS 服务器 (逗号分隔)' },
  'label.envVars': { en: 'Environment Variables', zh: '环境变量' },
  'label.advanced': { en: 'Advanced Options', zh: '高级选项' },
  'label.profileName': { en: 'Profile Name', zh: '实例名称' },

  // Tree view labels
  'view.profiles': { en: 'Profiles', zh: '配置实例' },
  'view.containers': { en: 'Containers', zh: '容器' },
  'view.kubernetes': { en: 'Kubernetes', zh: 'Kubernetes' },
  'view.models': { en: 'AI Models', zh: 'AI 模型' },

  // Welcome messages
  'welcome.notRunning': { en: 'Colima is not running.', zh: 'Colima 未运行。' },
  'welcome.start': { en: 'Start Colima', zh: '启动 Colima' },
  'welcome.quickStart': { en: 'Quick Start', zh: '快速启动' },
  'welcome.noContainers': { en: 'No containers running.\nStart Colima and run a container to see it here.', zh: '没有运行中的容器。\n启动 Colima 并运行容器后会显示在这里。' },
  'welcome.k8sNotEnabled': { en: 'Kubernetes is not enabled.', zh: 'Kubernetes 未启用。' },
  'welcome.startK8s': { en: 'Start with Kubernetes', zh: '以 Kubernetes 模式启动' },
  'welcome.noModels': { en: 'No AI models available.\nRequires Docker runtime and krunkit VM type.', zh: '没有可用的 AI 模型。\n需要 Docker 运行时和 krunkit 虚拟机类型。' },
  'welcome.setupModels': { en: 'Setup Models', zh: '设置模型' },
  'welcome.readDocs': { en: 'read the docs', zh: '阅读文档' },

  // Notifications
  'notify.started': { en: 'Colima: Started successfully', zh: 'Colima: 启动成功' },
  'notify.stopped': { en: 'Colima: Stopped successfully', zh: 'Colima: 已停止' },
  'notify.restarted': { en: 'Colima: Restarted successfully', zh: 'Colima: 重启成功' },
  'notify.deleted': { en: 'Colima: Instance deleted', zh: 'Colima: 实例已删除' },
  'notify.alreadyRunning': { en: 'Colima is already running', zh: 'Colima 已经在运行中' },
  'notify.startFailed': { en: 'Failed to start Colima', zh: '启动 Colima 失败' },
  'notify.stopFailed': { en: 'Failed to stop Colima', zh: '停止 Colima 失败' },
  'notify.restartFailed': { en: 'Failed to restart Colima', zh: '重启 Colima 失败' },
  'notify.deleteFailed': { en: 'Failed to delete Colima instance', zh: '删除 Colima 实例失败' },
  'notify.notInstalled': { en: 'Colima is not installed or not found in PATH', zh: 'Colima 未安装或在 PATH 中找不到' },
  'notify.installHomebrew': { en: 'Install with Homebrew', zh: '使用 Homebrew 安装' },
  'notify.setPathManually': { en: 'Set Path Manually', zh: '手动设置路径' },
  'notify.dismiss': { en: 'Dismiss', zh: '忽略' },
  'notify.noProfiles': { en: 'Colima: No profiles found. Start Colima first.', zh: 'Colima: 未找到配置实例。请先启动 Colima。' },
  'notify.noRunningProfiles': { en: 'Colima: No running profiles found.', zh: 'Colima: 没有运行中的实例。' },
  'notify.configSaved': { en: 'Colima: Configuration saved', zh: 'Colima: 配置已保存' },
  'notify.containerStopped': { en: 'Colima: Container stopped', zh: 'Colima: 容器已停止' },
  'notify.containerRestarted': { en: 'Colima: Container restarted', zh: 'Colima: 容器已重启' },
  'notify.containerRemoved': { en: 'Colima: Container removed', zh: 'Colima: 容器已移除' },
  'notify.k8sStarted': { en: 'Colima: Kubernetes started', zh: 'Colima: Kubernetes 已启动' },
  'notify.k8sStopped': { en: 'Colima: Kubernetes stopped', zh: 'Colima: Kubernetes 已停止' },
  'notify.k8sReset': { en: 'Colima: Kubernetes reset', zh: 'Colima: Kubernetes 已重置' },
  'notify.k8sDeleted': { en: 'Colima: Kubernetes deleted', zh: 'Colima: Kubernetes 已删除' },
  'notify.modelPulled': { en: 'Colima: Model pulled successfully', zh: 'Colima: 模型拉取成功' },
  'notify.modelSetup': { en: 'Colima: AI model runner setup complete', zh: 'Colima: AI 模型运行器设置完成' },
  'notify.updated': { en: 'Colima: Container runtime updated', zh: 'Colima: 容器运行时已更新' },
  'notify.pruned': { en: 'Colima: Cache pruned successfully', zh: 'Colima: 缓存清理成功' },
  'notify.profileSwitched': { en: 'Colima: Active profile set to', zh: 'Colima: 当前实例已切换为' },

  // Progress messages
  'progress.starting': { en: 'Starting Colima', zh: '正在启动 Colima' },
  'progress.stopping': { en: 'Stopping Colima', zh: '正在停止 Colima' },
  'progress.restarting': { en: 'Restarting Colima', zh: '正在重启 Colima' },
  'progress.deleting': { en: 'Deleting Colima instance', zh: '正在删除 Colima 实例' },
  'progress.startingK8s': { en: 'Starting Kubernetes', zh: '正在启动 Kubernetes' },
  'progress.stoppingK8s': { en: 'Stopping Kubernetes', zh: '正在停止 Kubernetes' },
  'progress.resettingK8s': { en: 'Resetting Kubernetes', zh: '正在重置 Kubernetes' },
  'progress.deletingK8s': { en: 'Deleting Kubernetes', zh: '正在删除 Kubernetes' },
  'progress.pullingModel': { en: 'Pulling model', zh: '正在拉取模型' },
  'progress.settingUpModels': { en: 'Setting up AI model runner', zh: '正在设置 AI 模型运行器' },
  'progress.updating': { en: 'Updating container runtime', zh: '正在更新容器运行时' },
  'progress.pruning': { en: 'Pruning cache', zh: '正在清理缓存' },
  'progress.done': { en: 'Done', zh: '完成' },

  // Confirmations
  'confirm.delete': { en: 'Delete Colima instance', zh: '删除 Colima 实例' },
  'confirm.deleteDetail': { en: 'This will permanently delete the VM, all containers, images, and configuration. This action cannot be undone.', zh: '这将永久删除虚拟机、所有容器、镜像和配置。此操作不可撤销。' },
  'confirm.deleteProfile': { en: 'Delete Colima profile', zh: '删除 Colima 配置实例' },
  'confirm.resetK8s': { en: 'Reset Kubernetes', zh: '重置 Kubernetes' },
  'confirm.resetK8sDetail': { en: 'This will reset the Kubernetes cluster. All pods and resources will be lost.', zh: '这将重置 Kubernetes 集群。所有 Pod 和资源将丢失。' },
  'confirm.deleteK8s': { en: 'Delete Kubernetes', zh: '删除 Kubernetes' },
  'confirm.deleteK8sDetail': { en: 'This will permanently delete the Kubernetes cluster and all its data.', zh: '这将永久删除 Kubernetes 集群及其所有数据。' },
  'confirm.removeContainer': { en: 'Remove container', zh: '移除容器' },
  'confirm.removeContainerDetail': { en: 'This will permanently remove the container.', zh: '这将永久移除该容器。' },
  'confirm.prune': { en: 'Prune cached assets?', zh: '清理缓存资源？' },
  'confirm.pruneDetail': { en: 'This will remove cached download assets. You may need to re-download them later.', zh: '这将移除已缓存的下载资源。之后可能需要重新下载。' },
  'confirm': { en: 'Confirm', zh: '确认' },

  // Input prompts
  'input.profileName': { en: 'Enter profile name', zh: '输入配置名称' },
  'input.profileNamePlaceholder': { en: 'e.g. dev, prod, k8s', zh: '例如 dev, prod, k8s' },
  'input.profileNameError': { en: 'Name cannot be empty', zh: '名称不能为空' },
  'input.profileNameErrorSpace': { en: 'Name cannot contain spaces', zh: '名称不能包含空格' },
  'input.modelName': { en: 'Enter model name to pull', zh: '输入要拉取的模型名称' },
  'input.modelNamePlaceholder': { en: 'e.g. ai/smollm2, hf://tinyllama', zh: '例如 ai/smollm2, hf://tinyllama' },
  'input.port': { en: 'Enter port number', zh: '输入端口号' },
  'input.selectProfile': { en: 'Select profile', zh: '选择实例' },
  'input.selectProfileStop': { en: 'Select profile to stop', zh: '选择要停止的实例' },
  'input.selectProfileRestart': { en: 'Select profile to restart', zh: '选择要重启的实例' },
  'input.selectProfileDelete': { en: 'Select profile to delete', zh: '选择要删除的实例' },
  'input.selectProfileSSH': { en: 'Select profile to SSH into', zh: '选择要 SSH 进入的实例' },
  'input.selectProfileUpdate': { en: 'Select profile to update runtime', zh: '选择要更新运行时的实例' },
  'input.selectModel': { en: 'Select model to run', zh: '选择要运行的模型' },
  'input.selectModelServe': { en: 'Select model to serve', zh: '选择要服务的模型' },
  'input.howToStop': { en: 'How to stop Colima?', zh: '如何停止 Colima？' },
  'input.gracefulStop': { en: 'Graceful Stop', zh: '优雅停止' },
  'input.forceStop': { en: 'Force Stop', zh: '强制停止' },
  'input.whatToDelete': { en: 'What to delete?', zh: '删除什么？' },
  'input.deleteVMOnly': { en: 'Delete VM Only', zh: '仅删除虚拟机' },
  'input.deleteEverything': { en: 'Delete Everything', zh: '删除所有数据' },
  'input.whatToPrune': { en: 'What to prune?', zh: '清理什么？' },
  'input.pruneColima': { en: 'Prune Colima Cache', zh: '清理 Colima 缓存' },
  'input.pruneAll': { en: 'Prune All (including Lima)', zh: '清理全部 (包括 Lima)' },

  // Config editor
  'config.title': { en: 'Colima Configuration', zh: 'Colima 配置' },
  'config.subtitle': { en: 'Edit configuration visually. Click Save to apply.', zh: '可视化编辑配置。点击保存生效。' },
  'config.resources': { en: 'Resources', zh: '资源' },
  'config.runtime': { en: 'Runtime', zh: '运行时' },
  'config.network': { en: 'Network', zh: '网络' },
  'config.kubernetes': { en: 'Kubernetes', zh: 'Kubernetes' },
  'config.advanced': { en: 'Advanced', zh: '高级' },
  'config.save': { en: 'Save Configuration', zh: '保存配置' },
  'config.immutableNote': { en: '⚠ Immutable (set at creation)', zh: '⚠ 不可变 (创建时设置)' },

  // Errors
  'error.failedToListProfiles': { en: 'Failed to list profiles', zh: '获取实例列表失败' },
  'error.failedToGetStatus': { en: 'Failed to get status', zh: '获取状态失败' },
  'error.failedToStart': { en: 'Failed to start Colima', zh: '启动 Colima 失败' },
  'error.dockerNotAvailable': { en: 'Docker context not available. Is Colima running?', zh: 'Docker 上下文不可用。Colima 是否在运行？' },
  'error.configNotFound': { en: 'Config for profile not found. Start the profile first to generate it.', zh: '未找到配置文件。请先启动实例以生成配置。' },
  'error.noModels': { en: 'No models available. Pull a model first.', zh: '没有可用模型。请先拉取模型。' },

  // Misc
  'misc.pods': { en: 'pods', zh: '个 Pod' },
  'misc.showOutput': { en: 'Show Output', zh: '显示输出' },
  'misc.colimaNotRunning': { en: 'colima is not running', zh: 'colima 未运行' },

  // Attach to VS Code
  'attach.title': { en: 'Colima: Attach to VS Code', zh: 'Colima: 附加到 VS Code' },
  'attach.noRunningProfiles': { en: 'No running profiles found. Start Colima first.', zh: '没有运行中的实例。请先启动 Colima。' },
  'attach.selectProfile': { en: 'Select profile to attach', zh: '选择要附加的实例' },
  'attach.attaching': { en: 'Attaching to Colima VM...', zh: '正在附加到 Colima 虚拟机...' },
  'attach.gettingSSH': { en: 'Getting SSH config...', zh: '获取 SSH 配置...' },
  'attach.updatingSSH': { en: 'Updating SSH config...', zh: '更新 SSH 配置...' },
  'attach.gettingHome': { en: 'Getting VM home directory...', zh: '获取虚拟机主目录...' },
  'attach.openingRemote': { en: 'Opening remote window...', zh: '打开远程窗口...' },
  'attach.needRemoteSSH': { en: 'Attaching requires the Remote-SSH extension. Install it now?', zh: '附加功能需要安装 Remote-SSH 扩展。是否立即安装？' },
  'attach.install': { en: 'Install', zh: '安装' },
  'attach.installed': { en: 'Remote-SSH installed. Please retry the attach action.', zh: 'Remote-SSH 已安装，请重新尝试附加操作。' },
  'attach.failed': { en: 'Attach to VS Code', zh: '附加到 VS Code' },
};

export function t(key: string): string {
  const msg = messages[key];
  if (!msg) return key;
  return msg[currentLocale] ?? msg.en ?? key;
}
