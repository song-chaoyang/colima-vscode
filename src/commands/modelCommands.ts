import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import { t } from '../i18n';
import { handleError, withProgress } from '../utils/errorHandler';
import { ModelNode } from '../treeview/modelsTreeProvider';

export function registerModelCommands(client: ColimaClient, refreshCallback: () => void): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.model.list', async () => { refreshCallback(); }),

    vscode.commands.registerCommand('colima.model.pull', async () => {
      // Check if AI models are available (requires krunkit VM type)
      if (!(await checkKrunkitAvailable(client))) return;

      const model = await vscode.window.showInputBox({
        prompt: t('input.modelName'),
        placeHolder: t('input.modelNamePlaceholder'),
      });
      if (!model) return;
      const profile = await pickProfile(client);
      if (!profile) return;
      try {
        await withProgress(`${t('progress.pullingModel')} "${model}"...`, async (report) => {
          report('Downloading...');
          await client.modelPull(model, profile);
        });
        void vscode.window.showInformationMessage(`${t('notify.modelPulled')}: ${model}`);
        refreshCallback();
      } catch (e) { handleError(e, `Pull "${model}"`); }
    }),

    vscode.commands.registerCommand('colima.model.run', async (node?: ModelNode) => {
      if (!(await checkKrunkitAvailable(client))) return;

      let modelName: string | undefined;
      if (node) { modelName = node.label; }
      else {
        const profile = await pickProfile(client);
        if (!profile) return;
        try {
          const models = await client.modelList(profile);
          if (models.length === 0) { void vscode.window.showInformationMessage(t('error.noModels')); return; }
          const choice = await vscode.window.showQuickPick(models.map((m) => ({ label: m })), { placeHolder: t('input.selectModel') });
          modelName = choice?.label;
        } catch (e) { handleError(e, 'List models'); return; }
      }
      if (!modelName) return;
      const profile = await pickProfile(client);
      if (!profile) return;
      const terminal = vscode.window.createTerminal({ name: `Colima: Run ${modelName}` });
      terminal.show();
      const profileArg = profile !== 'default' ? `-p ${profile}` : '';
      terminal.sendText(`${client.getBinaryPath()} model run ${modelName} ${profileArg}`.trim());
    }),

    vscode.commands.registerCommand('colima.model.serve', async (node?: ModelNode) => {
      if (!(await checkKrunkitAvailable(client))) return;

      let modelName: string | undefined;
      if (node) { modelName = node.label; }
      else {
        const profile = await pickProfile(client);
        if (!profile) return;
        try {
          const models = await client.modelList(profile);
          if (models.length === 0) { void vscode.window.showInformationMessage(t('error.noModels')); return; }
          const choice = await vscode.window.showQuickPick(models.map((m) => ({ label: m })), { placeHolder: t('input.selectModelServe') });
          modelName = choice?.label;
        } catch { return; }
      }
      if (!modelName) return;
      const port = await vscode.window.showInputBox({ prompt: t('input.port'), value: '8080', validateInput: (v) => { const n = parseInt(v, 10); return isNaN(n) || n < 1 || n > 65535 ? 'Invalid port' : null; } });
      if (!port) return;
      const profile = await pickProfile(client);
      if (!profile) return;
      const terminal = vscode.window.createTerminal({ name: `Colima: Serve ${modelName}` });
      terminal.show();
      const profileArg = profile !== 'default' ? `-p ${profile}` : '';
      terminal.sendText(`${client.getBinaryPath()} model serve ${modelName} --port ${port} ${profileArg}`.trim());
    }),

    vscode.commands.registerCommand('colima.model.setup', async () => {
      if (!(await checkKrunkitAvailable(client))) return;
      const profile = await pickProfile(client);
      if (!profile) return;
      try {
        await withProgress(t('progress.settingUpModels'), async (report) => { report('Installing...'); await client.modelSetup(profile); });
        void vscode.window.showInformationMessage(t('notify.modelSetup'));
      } catch (e) { handleError(e, 'Model setup'); }
    }),
  ];
}

/**
 * Check if the current Colima VM supports AI models (requires krunkit VM type).
 * Shows a helpful warning with instructions if not.
 */
async function checkKrunkitAvailable(client: ColimaClient): Promise<boolean> {
  try {
    const status = await client.getStatus();
    // colima model commands require krunkit VM type
    const driver = status.driver.toLowerCase();
    if (!driver.includes('krunkit')) {
      const zh = vscode.env.language.startsWith('zh');
      const msg = zh
        ? 'AI 模型功能需要 krunkit 虚拟机类型。\n\n虚拟机类型创建后不可更改，需要先删除再重建：\n\ncolima delete\ncolima start --runtime docker --vm-type krunkit\n\n⚠️ 删除会清除所有容器和镜像数据'
        : 'AI model features require krunkit VM type.\n\nVM type is immutable after creation. You must delete and recreate:\n\ncolima delete\ncolima start --runtime docker --vm-type krunkit\n\n⚠️ Deleting will remove all container and image data';
      const actionDelete = zh ? '删除并重建' : 'Delete & Recreate';
      const choice = await vscode.window.showWarningMessage(msg, { modal: true }, actionDelete);
      if (choice === actionDelete) {
        const terminal = vscode.window.createTerminal('Colima: Recreate with krunkit');
        terminal.show();
        terminal.sendText('colima delete && colima start --runtime docker --vm-type krunkit');
      }
      return false;
    }
    return true;
  } catch {
    // If we can't check status, let the command proceed and show the real error
    return true;
  }
}

async function pickProfile(client: ColimaClient): Promise<string | undefined> {
  try {
    const profiles = (await client.listProfiles()).filter((p) => p.status === 'Running');
    if (profiles.length === 0) { void vscode.window.showWarningMessage(t('notify.noRunningProfiles')); return undefined; }
    if (profiles.length === 1) return profiles[0].name;
    const items = profiles.map((p) => ({ label: p.name, description: p.runtime }));
    const choice = await vscode.window.showQuickPick(items, { placeHolder: t('input.selectProfile') });
    return choice?.label;
  } catch { return 'default'; }
}
