import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { TerminalManager } from '../terminal/terminalManager';
import { t } from '../i18n';
import { handleError, confirmAction } from '../utils/errorHandler';
import { ContainerNode } from '../treeview/containersTreeProvider';

export function registerContainerCommands(
  client: ColimaClient,
  terminal: TerminalManager,
  refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.container.stop', async (node: ContainerNode) => {
      try {
        await client.dockerStop(node.container.id);
        void vscode.window.showInformationMessage(`${t('notify.containerStopped')}: ${node.container.name}`);
        refreshCallback();
      } catch (e) { handleError(e, `Stop "${node.container.name}"`); }
    }),

    vscode.commands.registerCommand('colima.container.restart', async (node: ContainerNode) => {
      try {
        await client.dockerRestart(node.container.id);
        void vscode.window.showInformationMessage(`${t('notify.containerRestarted')}: ${node.container.name}`);
        refreshCallback();
      } catch (e) { handleError(e, `Restart "${node.container.name}"`); }
    }),

    vscode.commands.registerCommand('colima.container.remove', async (node: ContainerNode) => {
      const confirmed = await confirmAction(`${t('confirm.removeContainer')} "${node.container.name}"?`, t('confirm.removeContainerDetail'));
      if (!confirmed) return;
      try {
        await client.dockerRemove(node.container.id);
        void vscode.window.showInformationMessage(`${t('notify.containerRemoved')}: ${node.container.name}`);
        refreshCallback();
      } catch (e) { handleError(e, `Remove "${node.container.name}"`); }
    }),

    vscode.commands.registerCommand('colima.container.logs', async (node: ContainerNode) => {
      terminal.showContainerLogs(node.container.id);
    }),

    vscode.commands.registerCommand('colima.container.exec', async (node: ContainerNode) => {
      terminal.execContainer(node.container.id);
    }),

    vscode.commands.registerCommand('colima.container.inspect', async (node: ContainerNode) => {
      await terminal.inspectContainer(node.container.id);
    }),
  ];
}
