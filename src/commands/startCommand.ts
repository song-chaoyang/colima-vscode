import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { StartOptions } from '../types';
import { PRESETS } from '../constants';
import { t } from '../i18n';
import { handleError, withProgress } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { runCommand } from '../utils/commandRunner';
import type { StartWizard } from '../webview/startWizard';

export function registerStartCommands(
  client: ColimaClient,
  startWizard: StartWizard,
  refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.start', async (args?: { profile?: string }) => {
      startWizard.show(args?.profile);
    }),

    vscode.commands.registerCommand('colima.start.quick', async () => {
      await startWithPreset(client, PRESETS.quick, t('preset.quick'), refreshCallback);
    }),

    vscode.commands.registerCommand('colima.start.preset.dev', async () => {
      await startWithPreset(client, PRESETS.dev, t('preset.dev'), refreshCallback);
    }),

    vscode.commands.registerCommand('colima.start.preset.k8s', async () => {
      await startWithPreset(client, PRESETS.k8s, t('preset.k8s'), refreshCallback);
    }),

    vscode.commands.registerCommand('colima.start.preset.containerd', async () => {
      await startWithPreset(client, PRESETS.containerd, t('preset.containerd'), refreshCallback);
    }),

    vscode.commands.registerCommand('colima.start.preset.ai', async () => {
      await startWithPreset(client, PRESETS.ai, t('preset.ai'), refreshCallback);
    }),
  ];
}

async function startWithPreset(
  client: ColimaClient,
  preset: { cpu: number; memory: number; disk: number; runtime: string; kubernetes?: boolean; vmType?: string },
  label: string,
  refreshCallback: () => void,
): Promise<void> {
  try {
    // Resolve 'auto' runtime: docker if available, otherwise containerd
    let runtime = preset.runtime;
    if (runtime === 'auto') {
      const dockerCheck = await runCommand('docker', ['--version'], { timeout: 5000 });
      runtime = dockerCheck.exitCode === 0 ? 'docker' : 'containerd';
      logger.info(`Auto runtime resolved to: ${runtime} (docker ${dockerCheck.exitCode === 0 ? 'found' : 'not found'})`);
    }

    const options: StartOptions = {
      cpu: preset.cpu,
      memory: preset.memory,
      disk: preset.disk,
      runtime: runtime as StartOptions['runtime'],
      kubernetes: preset.kubernetes ?? false,
      vmType: preset.vmType as StartOptions['vmType'],
    };

    await withProgress(`${t('progress.starting')} (${label})...`, async (report) => {
      report('Starting VM...');
      await client.start(options, (output) => {
        const lines = output.split('\n').filter((l) => l.trim());
        if (lines.length > 0) {
          // Extract useful info from colima's log lines
          const lastLine = lines[lines.length - 1].trim();
          if (lastLine.includes('level=')) {
            const msgMatch = lastLine.match(/msg="([^"]+)"/);
            if (msgMatch) report(msgMatch[1]);
          } else {
            report(lastLine);
          }
        }
      });
      report(t('progress.done'));
    });

    void vscode.window.showInformationMessage(`${t('notify.started')} (${label})`);
    refreshCallback();
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.includes('docker not found') || errMsg.includes('dependency check failed for docker')) {
      const zh = vscode.env.language.startsWith('zh');
      const actionInstall = zh ? '安装 Docker CLI' : 'Install Docker CLI';
      const actionContainerd = zh ? '使用 Containerd 运行时' : 'Use Containerd Runtime';
      const choice = await vscode.window.showErrorMessage(
        zh
          ? 'Colima 的 docker 运行时需要 Docker CLI。\n\n你可以：\n1. 安装 Docker CLI 后再启动\n2. 使用 Containerd 运行时（不需要 Docker CLI）'
          : 'Colima docker runtime requires the Docker CLI.\n\nYou can:\n1. Install Docker CLI and try again\n2. Use Containerd runtime (no Docker CLI needed)',
        actionInstall,
        actionContainerd,
      );
      if (choice === actionInstall) {
        // Call the install command which will detect missing docker and offer to install it
        await vscode.commands.executeCommand('colima.install');
      } else if (choice === actionContainerd) {
        // Retry with containerd runtime
        const containerdPreset = { ...preset, runtime: 'containerd' as const };
        await startWithPreset(client, containerdPreset, label, refreshCallback);
      }
    } else {
      handleError(e, `${t('notify.startFailed')} (${label})`);
    }
  }
}

export async function startProfile(
  client: ColimaClient,
  profileName: string,
  refreshCallback: () => void,
): Promise<void> {
  try {
    await withProgress(`${t('progress.starting')} "${profileName}"...`, async (report) => {
      await client.start({ profile: profileName }, (output) => {
        const lines = output.split('\n').filter((l) => l.trim());
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1].trim();
          if (lastLine.includes('level=')) {
            const msgMatch = lastLine.match(/msg="([^"]+)"/);
            if (msgMatch) report(msgMatch[1]);
          } else {
            report(lastLine);
          }
        }
      });
    });
    void vscode.window.showInformationMessage(`Colima: ${profileName} ${t('status.running').toLowerCase()}`);
    refreshCallback();
  } catch (e) {
    handleError(e, `${t('notify.startFailed')} "${profileName}"`);
  }
}

export async function startWithOptions(
  client: ColimaClient,
  options: StartOptions,
  refreshCallback: () => void,
): Promise<void> {
  try {
    await withProgress(t('progress.starting'), async (report) => {
      await client.start(options, (output) => {
        const lines = output.split('\n').filter((l) => l.trim());
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1].trim();
          if (lastLine.includes('level=')) {
            const msgMatch = lastLine.match(/msg="([^"]+)"/);
            if (msgMatch) report(msgMatch[1]);
          } else {
            report(lastLine);
          }
        }
      });
    });
    void vscode.window.showInformationMessage(t('notify.started'));
    refreshCallback();
  } catch (e) {
    handleError(e, t('notify.startFailed'));
  }
}
