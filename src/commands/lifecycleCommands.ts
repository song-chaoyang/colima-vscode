import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { TerminalManager } from '../terminal/terminalManager';
import { t } from '../i18n';
import { handleError, withProgress, confirmAction } from '../utils/errorHandler';

export function registerLifecycleCommands(
  client: ColimaClient,
  terminal: TerminalManager,
  refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.stop', async () => {
      const profile = await pickProfile(client, t('input.selectProfileStop'));
      if (!profile) return;
      await stopProfile(client, profile, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.restart', async () => {
      const profile = await pickProfile(client, t('input.selectProfileRestart'));
      if (!profile) return;
      await restartProfile(client, profile, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.delete', async () => {
      const profile = await pickProfile(client, t('input.selectProfileDelete'));
      if (!profile) return;
      await deleteProfile(client, profile, refreshCallback);
    }),

    vscode.commands.registerCommand('colima.status', async () => {
      await showStatus(client);
    }),

    vscode.commands.registerCommand('colima.ssh', async () => {
      const profile = await pickProfile(client, t('input.selectProfileSSH'));
      if (!profile) return;
      terminal.openSSH(profile);
    }),

    vscode.commands.registerCommand('colima.sshConfig', async () => {
      const profile = await pickProfile(client, t('input.selectProfile'));
      if (!profile) return;
      try {
        const config = await client.sshConfig(profile);
        const doc = await vscode.workspace.openTextDocument({ content: config, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);
      } catch (e) {
        handleError(e, 'SSH config');
      }
    }),
  ];
}

async function pickProfile(client: ColimaClient, placeholder: string): Promise<string | undefined> {
  try {
    const profiles = await client.listProfiles();
    if (profiles.length === 0) {
      void vscode.window.showWarningMessage(t('notify.noProfiles'));
      return undefined;
    }
    const items = profiles.map((p) => ({
      label: p.name,
      description: p.status,
      detail: `${p.runtime} · ${p.cpus} CPU · ${p.memory > 0 ? Math.round(p.memory / 1073741824) : '?'} GiB`,
    }));
    const choice = await vscode.window.showQuickPick(items, { placeHolder: placeholder });
    return choice?.label;
  } catch (e) {
    handleError(e, t('error.failedToListProfiles'));
    return undefined;
  }
}

export async function stopProfile(client: ColimaClient, profile: string, refreshCallback: () => void): Promise<void> {
  const force = await vscode.window.showQuickPick(
    [
      { label: t('input.gracefulStop'), description: '' },
      { label: t('input.forceStop'), description: '' },
    ],
    { placeHolder: t('input.howToStop') },
  );
  if (!force) return;
  try {
    await withProgress(`${t('progress.stopping')} "${profile}"...`, async () => {
      await client.stop(profile, force.label === t('input.forceStop'));
    });
    void vscode.window.showInformationMessage(`Colima: ${profile} ${t('status.stopped').toLowerCase()}`);
    refreshCallback();
  } catch (e) {
    handleError(e, `${t('notify.stopFailed')} "${profile}"`);
  }
}

export async function restartProfile(client: ColimaClient, profile: string, refreshCallback: () => void): Promise<void> {
  try {
    await withProgress(`${t('progress.restarting')} "${profile}"...`, async () => {
      await client.restart(profile);
    });
    void vscode.window.showInformationMessage(`Colima: ${profile} ${t('notify.restarted')}`);
    refreshCallback();
  } catch (e) {
    handleError(e, `${t('notify.restartFailed')} "${profile}"`);
  }
}

export async function deleteProfile(client: ColimaClient, profile: string, refreshCallback: () => void): Promise<void> {
  const confirmed = await confirmAction(
    `${t('confirm.deleteProfile')} "${profile}"?`,
    t('confirm.deleteDetail'),
  );
  if (!confirmed) return;

  const withData = await vscode.window.showQuickPick(
    [
      { label: t('input.deleteVMOnly'), description: '' },
      { label: t('input.deleteEverything'), description: '' },
    ],
    { placeHolder: t('input.whatToDelete') },
  );
  if (!withData) return;

  try {
    await withProgress(`${t('progress.deleting')} "${profile}"...`, async () => {
      await client.delete(profile, true, withData.label === t('input.deleteEverything'));
    });
    void vscode.window.showInformationMessage(`Colima: ${profile} ${t('notify.deleted').toLowerCase()}`);
    refreshCallback();
  } catch (e) {
    handleError(e, `${t('notify.deleteFailed')} "${profile}"`);
  }
}

async function showStatus(client: ColimaClient): Promise<void> {
  try {
    const profiles = await client.listProfiles();
    if (profiles.length === 0) {
      void vscode.window.showInformationMessage('Colima: No instances found.');
      return;
    }
    const choice = await vscode.window.showQuickPick(
      profiles.map((p) => ({
        label: p.name,
        description: p.status,
        detail: `${p.runtime} · ${p.cpus} CPU · ${p.memory > 0 ? Math.round(p.memory / 1073741824) : '?'} GiB`,
      })),
      { placeHolder: t('input.selectProfile') },
    );
    if (!choice) return;

    const status = await client.getStatus(choice.label);
    const panel = vscode.window.createWebviewPanel('colimaStatus', `Colima: ${choice.label}`, vscode.ViewColumn.Active, { enableScripts: false });
    const memGiB = status.memory > 0 ? (status.memory / 1073741824).toFixed(2) : '?';
    const diskGiB = status.disk > 0 ? (status.disk / 1073741824).toFixed(2) : '?';
    panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:var(--vscode-font-family);padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
      h1{color:var(--vscode-textLink-foreground)}table{width:100%;border-collapse:collapse}
      td{padding:8px 16px;border-bottom:1px solid var(--vscode-editorWidget-border)}td:first-child{color:var(--vscode-descriptionForeground);font-weight:bold;width:40%}
    </style></head><body><h1>Colima: ${choice.label}</h1><table>
    <tr><td>Status</td><td>Running</td></tr>
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
    handleError(e, t('error.failedToGetStatus'));
  }
}
