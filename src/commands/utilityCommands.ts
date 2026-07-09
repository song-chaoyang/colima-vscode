import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { TerminalManager } from '../terminal/terminalManager';
import { t } from '../i18n';
import { handleError, withProgress, confirmAction } from '../utils/errorHandler';
import { runCommand } from '../utils/commandRunner';

export function registerUtilityCommands(
  client: ColimaClient,
  terminal: TerminalManager,
  refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.update', async () => {
      const profile = await pickProfile(client, t('input.selectProfileUpdate'));
      if (!profile) return;
      try {
        await withProgress(t('progress.updating'), async (report) => { report('Updating...'); await client.update(profile); });
        void vscode.window.showInformationMessage(`${t('notify.updated')} "${profile}"`);
        refreshCallback();
      } catch (e) { handleError(e, 'Update'); }
    }),

    vscode.commands.registerCommand('colima.prune', async () => {
      const all = await vscode.window.showQuickPick(
        [{ label: t('input.pruneColima'), description: '' }, { label: t('input.pruneAll'), description: '' }],
        { placeHolder: t('input.whatToPrune') },
      );
      if (!all) return;
      const confirmed = await confirmAction(t('confirm.prune'), t('confirm.pruneDetail'));
      if (!confirmed) return;
      try {
        await withProgress(t('progress.pruning'), async () => { await client.prune(all.label === t('input.pruneAll'), true); });
        void vscode.window.showInformationMessage(t('notify.pruned'));
      } catch (e) { handleError(e, 'Prune'); }
    }),

    vscode.commands.registerCommand('colima.openTerminal', async () => {
      const profile = await pickProfile(client, t('input.selectProfile'));
      if (!profile) return;
      terminal.openDockerShell(profile);
    }),

    vscode.commands.registerCommand('colima.refresh', () => { refreshCallback(); }),

    vscode.commands.registerCommand('colima.openDockerContext', async () => {
      try {
        const result = await runCommand('docker', ['context', 'ls']);
        if (result.exitCode === 0) {
          const doc = await vscode.workspace.openTextDocument({ content: result.stdout, language: 'plaintext' });
          await vscode.window.showTextDocument(doc);
        } else {
          void vscode.window.showWarningMessage(t('error.dockerNotAvailable'));
        }
      } catch (e) { handleError(e, 'Docker context'); }
    }),
  ];
}

async function pickProfile(client: ColimaClient, _placeholder: string): Promise<string | undefined> {
  try {
    const profiles = await client.listProfiles();
    if (profiles.length === 0) { void vscode.window.showWarningMessage(t('notify.noProfiles')); return undefined; }
    const items = profiles.map((p) => ({ label: p.name, description: p.status }));
    const choice = await vscode.window.showQuickPick(items, { placeHolder: _placeholder });
    return choice?.label;
  } catch { return 'default'; }
}
