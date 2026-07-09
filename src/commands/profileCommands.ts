import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { TerminalManager } from '../terminal/terminalManager';
import { t } from '../i18n';
import { handleError } from '../utils/errorHandler';
import { runCommand } from '../utils/commandRunner';
import { startProfile } from './startCommand';
import { stopProfile, restartProfile, deleteProfile } from './lifecycleCommands';
import { configManager } from '../colima/colimaConfig';
import { ProfileNode } from '../treeview/profilesTreeProvider';

export function registerProfileCommands(
  client: ColimaClient,
  terminal: TerminalManager,
  refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.profile.create', async () => {
      // Get list of existing profiles to validate uniqueness
      let existingNames: string[] = [];
      try {
        existingNames = (await client.listProfiles()).map((p) => p.name);
      } catch { /* ignore */ }

      const name = await vscode.window.showInputBox({
        prompt: t('input.profileName'),
        placeHolder: t('input.profileNamePlaceholder'),
        validateInput: (v) => {
          const trimmed = v.trim();
          if (!trimmed) return t('input.profileNameError');
          if (trimmed.includes(' ')) return t('input.profileNameErrorSpace');
          if (existingNames.includes(trimmed)) {
            return vscode.env.language.startsWith('zh')
              ? `实例 "${trimmed}" 已存在，请使用其他名称`
              : `Profile "${trimmed}" already exists, use a different name`;
          }
          return null;
        },
      });
      if (!name) return;
      // Open the start wizard with the new profile name pre-filled
      void vscode.commands.executeCommand('colima.start', { profile: name });
    }),

    vscode.commands.registerCommand('colima.profile.switch', async () => {
      try {
        const profiles = await client.listProfiles();
        const items = profiles.map((p) => ({ label: p.name, description: p.status }));
        const choice = await vscode.window.showQuickPick(items, { placeHolder: t('input.selectProfile') });
        if (!choice) return;
        refreshCallback();
        void vscode.window.showInformationMessage(`${t('notify.profileSwitched')} "${choice.label}"`);
      } catch (e) {
        handleError(e, t('error.failedToListProfiles'));
      }
    }),

    vscode.commands.registerCommand('colima.profile.start', async (node: ProfileNode) => {
      await startProfile(client, node.profile.name, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.profile.stop', async (node: ProfileNode) => {
      await stopProfile(client, node.profile.name, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.profile.restart', async (node: ProfileNode) => {
      await restartProfile(client, node.profile.name, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.profile.delete', async (node: ProfileNode) => {
      await deleteProfile(client, node.profile.name, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.profile.ssh', async (node: ProfileNode) => {
      terminal.openSSH(node.profile.name);
    }),

    vscode.commands.registerCommand('colima.profile.status', async (node: ProfileNode) => {
      try {
        const status = await client.getStatus(node.profile.name);
        const panel = vscode.window.createWebviewPanel('colimaProfileStatus', `Colima: ${node.profile.name}`, vscode.ViewColumn.Active, { enableScripts: false });
        const memGiB = status.memory > 0 ? (status.memory / 1073741824).toFixed(2) : '?';
        const diskGiB = status.disk > 0 ? (status.disk / 1073741824).toFixed(2) : '?';
        panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body{font-family:var(--vscode-font-family);padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
          h1{color:var(--vscode-textLink-foreground)}table{width:100%;border-collapse:collapse}
          td{padding:8px 16px;border-bottom:1px solid var(--vscode-editorWidget-border)}td:first-child{color:var(--vscode-descriptionForeground);font-weight:bold;width:40%}
        </style></head><body><h1>${node.profile.name}</h1><table>
        <tr><td>Status</td><td>${node.profile.status}</td></tr>
        <tr><td>Driver</td><td>${status.driver}</td></tr>
        <tr><td>Architecture</td><td>${status.arch}</td></tr>
        <tr><td>Runtime</td><td>${status.runtime}</td></tr>
        <tr><td>Mount Type</td><td>${status.mountType}</td></tr>
        <tr><td>Docker Socket</td><td>${status.dockerSocket ?? 'N/A'}</td></tr>
        <tr><td>Containerd Socket</td><td>${status.containerdSocket ?? 'N/A'}</td></tr>
        <tr><td>Kubernetes</td><td>${status.kubernetes ? 'Enabled' : 'Disabled'}</td></tr>
        <tr><td>CPU</td><td>${status.cpu} cores</td></tr>
        <tr><td>Memory</td><td>${memGiB} GiB</td></tr>
        <tr><td>Disk</td><td>${diskGiB} GiB</td></tr>
        </table></body></html>`;
      } catch (e) {
        handleError(e, `${t('error.failedToGetStatus')} "${node.profile.name}"`);
      }
    }),

    vscode.commands.registerCommand('colima.profile.configEdit', async (node: ProfileNode) => {
      const configPath = configManager.getConfigPath(node.profile.name);
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
        await vscode.window.showTextDocument(doc);
      } catch {
        void vscode.window.showInformationMessage(t('error.configNotFound'));
      }
    }),

    vscode.commands.registerCommand('colima.profile.configVisualEdit', async (node: ProfileNode) => {
      void vscode.commands.executeCommand('colima.config.edit', node.profile.name);
    }),

    vscode.commands.registerCommand('colima.config.editTemplate', async () => {
      try {
        const result = await runCommand(client.getBinaryPath(), ['template', '--print']);
        if (result.exitCode === 0) {
          const configPath = result.stdout.trim();
          if (configPath) {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
            await vscode.window.showTextDocument(doc);
          }
        }
      } catch (e) {
        handleError(e, 'Template');
      }
    }),
  ];
}
