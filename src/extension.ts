import * as vscode from 'vscode';
import { logger } from './utils/logger';
import { initLocale, t } from './i18n';
import { ColimaClient } from './colima/colimaClient';
import { StatusBarController } from './statusbar/statusBarController';
import { TerminalManager } from './terminal/terminalManager';
import { ProfilesTreeProvider } from './treeview/profilesTreeProvider';
import { ContainersTreeProvider } from './treeview/containersTreeProvider';
import { KubernetesTreeProvider } from './treeview/kubernetesTreeProvider';
import { ModelsTreeProvider } from './treeview/modelsTreeProvider';
import { StartWizard } from './webview/startWizard';
import { ConfigEditor } from './webview/configEditor';
import { registerStartCommands } from './commands/startCommand';
import { registerLifecycleCommands } from './commands/lifecycleCommands';
import { registerProfileCommands } from './commands/profileCommands';
import { registerKubernetesCommands } from './commands/kubernetesCommands';
import { registerModelCommands } from './commands/modelCommands';
import { registerContainerCommands } from './commands/containerCommands';
import { registerUtilityCommands } from './commands/utilityCommands';
import { registerAttachCommand } from './commands/attachCommand';
import { registerInstallCommand } from './commands/installCommand';
import { VIEW } from './constants';

let refreshTimer: ReturnType<typeof setInterval> | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize i18n and logger
  initLocale();
  logger.init(context);

  const config = vscode.workspace.getConfiguration('colima');
  const customPath = config.get<string>('colimaPath', '');
  logger.updateVerboseSetting();

  // Initialize core client
  const client = new ColimaClient(customPath);
  logger.info(`Colima binary path: ${client.getBinaryPath()}`);

  // Check if colima is installed
  const installed = await client.isInstalled();
  if (!installed) {
    const zh = vscode.env.language.startsWith('zh');
    const choice = await vscode.window.showWarningMessage(
      t('notify.notInstalled'),
      zh ? '一键安装' : 'Install Now',
      zh ? '打开终端手动安装' : 'Open Terminal',
      zh ? '设置路径' : 'Set Path',
    );
    if (choice === (zh ? '一键安装' : 'Install Now')) {
      await vscode.commands.executeCommand('colima.install');
    } else if (choice === (zh ? '打开终端手动安装' : 'Open Terminal')) {
      const terminal = vscode.window.createTerminal('Install Colima');
      terminal.show();
      terminal.sendText('brew install colima');
    } else if (choice === (zh ? '设置路径' : 'Set Path')) {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'colima.colimaPath');
    }
    logger.warn('Colima not installed — extension will have limited functionality');
  }

  // Set context key for welcome view conditional rendering
  await vscode.commands.executeCommand('setContext', 'colima.installed', installed);

  // Initialize managers
  const terminal = new TerminalManager(client);
  context.subscriptions.push(terminal);

  const statusBarController = new StatusBarController(client);
  statusBarController.start();
  context.subscriptions.push(statusBarController);

  // Tree view providers
  const profilesProvider = new ProfilesTreeProvider(client);
  const containersProvider = new ContainersTreeProvider(client);
  const kubernetesProvider = new KubernetesTreeProvider(client);
  const modelsProvider = new ModelsTreeProvider(client);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEW.PROFILES, profilesProvider),
    vscode.window.registerTreeDataProvider(VIEW.CONTAINERS, containersProvider),
    vscode.window.registerTreeDataProvider(VIEW.KUBERNETES, kubernetesProvider),
    vscode.window.registerTreeDataProvider(VIEW.MODELS, modelsProvider),
  );

  // Webview panels
  const startWizard = new StartWizard(client, refreshAll);
  const configEditor = new ConfigEditor();

  function refreshAll(): void {
    profilesProvider.refresh();
    containersProvider.refresh();
    kubernetesProvider.refresh();
    modelsProvider.refresh();
    statusBarController.refresh().catch(() => {});
  }

  // Register all commands
  context.subscriptions.push(
    ...registerStartCommands(client, startWizard, refreshAll),
    ...registerLifecycleCommands(client, terminal, refreshAll),
    ...registerProfileCommands(client, terminal, refreshAll),
    ...registerKubernetesCommands(client, refreshAll),
    ...registerModelCommands(client, refreshAll),
    ...registerContainerCommands(client, terminal, refreshAll),
    ...registerUtilityCommands(client, terminal, refreshAll),
    ...registerAttachCommand(client, refreshAll),
    ...registerInstallCommand(client, refreshAll),

    vscode.commands.registerCommand('colima.config.edit', async (profile?: string) => {
      const profileName = profile ?? await pickProfile(client);
      if (!profileName) return;
      configEditor.show(profileName);
    }),
  );

  // Auto-refresh
  const autoRefresh = config.get<boolean>('autoRefresh', true);
  if (autoRefresh && installed) {
    const interval = config.get<number>('refreshInterval', 10) * 1000;
    refreshTimer = setInterval(() => refreshAll(), interval);
  }

  // Config change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('colima')) {
        const newConfig = vscode.workspace.getConfiguration('colima');
        const newCustomPath = newConfig.get<string>('colimaPath', '');
        if (newCustomPath !== customPath) {
          client.updatePath(newCustomPath);
        }
        logger.updateVerboseSetting();
        statusBarController.updateConfig();
      }
    }),
  );

  refreshAll();
  logger.info('Colima extension activated');
}

export function deactivate(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

async function pickProfile(client: ColimaClient): Promise<string | undefined> {
  try {
    const profiles = await client.listProfiles();
    if (profiles.length === 0) {
      void vscode.window.showWarningMessage(t('notify.noProfiles'));
      return undefined;
    }
    const items = profiles.map((p) => ({ label: p.name, description: p.status }));
    const choice = await vscode.window.showQuickPick(items, { placeHolder: t('input.selectProfile') });
    return choice?.label;
  } catch {
    return 'default';
  }
}
