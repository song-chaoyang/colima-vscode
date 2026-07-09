import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import { t } from '../i18n';
import { handleError, withProgress, confirmAction } from '../utils/errorHandler';

export function registerKubernetesCommands(client: ColimaClient, refreshCallback: () => void): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.kubernetes.start', async () => {
      const profile = await pickRunningProfile(client, t('input.selectProfile'));
      if (!profile) return;
      try {
        await withProgress(t('progress.startingK8s'), async (report) => {
          report('Starting k3s...');
          await client.kubernetesStart(profile);
        });
        void vscode.window.showInformationMessage(`${t('notify.k8sStarted')} "${profile}"`);
        refreshCallback();
      } catch (e) { handleError(e, 'K8s start'); }
    }),

    vscode.commands.registerCommand('colima.kubernetes.stop', async () => {
      const profile = await pickRunningProfile(client, t('input.selectProfile'));
      if (!profile) return;
      try {
        await withProgress(t('progress.stoppingK8s'), async () => { await client.kubernetesStop(profile); });
        void vscode.window.showInformationMessage(`${t('notify.k8sStopped')} "${profile}"`);
        refreshCallback();
      } catch (e) { handleError(e, 'K8s stop'); }
    }),

    vscode.commands.registerCommand('colima.kubernetes.reset', async () => {
      const profile = await pickRunningProfile(client, t('input.selectProfile'));
      if (!profile) return;
      const confirmed = await confirmAction(`${t('confirm.resetK8s')} "${profile}"?`, t('confirm.resetK8sDetail'));
      if (!confirmed) return;
      try {
        await withProgress(t('progress.resettingK8s'), async () => { await client.kubernetesReset(profile); });
        void vscode.window.showInformationMessage(`${t('notify.k8sReset')} "${profile}"`);
        refreshCallback();
      } catch (e) { handleError(e, 'K8s reset'); }
    }),

    vscode.commands.registerCommand('colima.kubernetes.delete', async () => {
      const profile = await pickRunningProfile(client, t('input.selectProfile'));
      if (!profile) return;
      const confirmed = await confirmAction(`${t('confirm.deleteK8s')} "${profile}"?`, t('confirm.deleteK8sDetail'));
      if (!confirmed) return;
      try {
        await withProgress(t('progress.deletingK8s'), async () => { await client.kubernetesDelete(profile); });
        void vscode.window.showInformationMessage(`${t('notify.k8sDeleted')} "${profile}"`);
        refreshCallback();
      } catch (e) { handleError(e, 'K8s delete'); }
    }),
  ];
}

async function pickRunningProfile(client: ColimaClient, _placeholder: string): Promise<string | undefined> {
  try {
    const profiles = (await client.listProfiles()).filter((p) => p.status === 'Running');
    if (profiles.length === 0) {
      void vscode.window.showWarningMessage(t('notify.noRunningProfiles'));
      return undefined;
    }
    if (profiles.length === 1) return profiles[0].name;
    const items = profiles.map((p) => ({ label: p.name, description: p.runtime }));
    const choice = await vscode.window.showQuickPick(items, { placeHolder: _placeholder });
    return choice?.label;
  } catch (e) {
    handleError(e, t('error.failedToListProfiles'));
    return undefined;
  }
}
