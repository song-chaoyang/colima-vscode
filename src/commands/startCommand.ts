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
      let dockerFound = false;
      try {
        const dockerCheck = await runCommand('docker', ['--version'], { timeout: 5000 });
        dockerFound = dockerCheck.exitCode === 0;
      } catch {
        dockerFound = false;
      }
      runtime = dockerFound ? 'docker' : 'containerd';
      logger.info(`Auto runtime resolved to: ${runtime} (docker ${dockerFound ? 'found' : 'not found'})`);
    }

    // Resolve 'auto' vmType: krunkit if installed, otherwise vz
    let vmType = preset.vmType;
    if (vmType === 'auto') {
      let krunkitFound = false;
      try {
        const krunkitCheck = await runCommand('krunkit', ['--version'], { timeout: 5000 });
        krunkitFound = krunkitCheck.exitCode === 0;
      } catch {
        krunkitFound = false;
      }
      vmType = krunkitFound ? 'krunkit' : 'vz';
      logger.info(`Auto vmType resolved to: ${vmType} (krunkit ${krunkitFound ? 'found' : 'not found'})`);

      if (!krunkitFound) {
        const zh = vscode.env.language.startsWith('zh');
        void vscode.window.showInformationMessage(
          zh
            ? '未检测到 krunkit，AI 模型功能需要 krunkit 虚拟机类型。已使用 VZ 启动，如需使用 AI 模型请安装 krunkit: brew tap slp/krunkit && brew trust slp/krunkit && brew install krunkit'
            : 'krunkit not found, using VZ instead. AI model features require krunkit. Install: brew tap slp/krunkit && brew trust slp/krunkit && brew install krunkit',
        );
      }
    }

    const options: StartOptions = {
      cpu: preset.cpu,
      memory: preset.memory,
      disk: preset.disk,
      runtime: runtime as StartOptions['runtime'],
      kubernetes: preset.kubernetes ?? false,
      vmType: vmType as StartOptions['vmType'],
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
      // Check for runtime disk conflict error
      if (errMsg.includes('runtime disk provisioned for') && errMsg.includes('Delete container data')) {
        const zh = vscode.env.language.startsWith('zh');
        const actionClean = zh ? '清理并重试' : 'Clean & Retry';
        const choice = await vscode.window.showErrorMessage(
          zh
            ? '检测到运行时冲突：之前的实例使用不同的运行时创建。\n\n点击"清理并重试"将自动删除旧数据并用新运行时重新创建。'
            : 'Runtime conflict detected: previous instance was created with a different runtime.\n\nClick "Clean & Retry" to automatically delete old data and recreate with the new runtime.',
          actionClean,
        );
        if (choice === actionClean) {
          // Delete old instance data and retry
          try {
            const zh2 = vscode.env.language.startsWith('zh');
            await withProgress(zh2 ? '正在清理旧数据...' : 'Cleaning old data...', async (report) => {
              report(zh2 ? '停止实例...' : 'Stopping instance...');
              await client.stop(undefined, true);
              report(zh2 ? '删除数据...' : 'Deleting data...');
              await client.delete(undefined, true, true);
            });
            // Retry start with the same preset
            await startWithPreset(client, preset, label, refreshCallback);
            return;
          } catch (cleanErr) {
            handleError(cleanErr, zh ? '清理失败' : 'Cleanup failed');
            return;
          }
        }
      }
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
    // Resolve 'auto' runtime: docker if available, otherwise containerd
    if ((options.runtime as string) === 'auto') {
      let dockerFound = false;
      try {
        const dockerCheck = await runCommand('docker', ['--version'], { timeout: 5000 });
        dockerFound = dockerCheck.exitCode === 0;
      } catch {
        dockerFound = false;
      }
      options.runtime = (dockerFound ? 'docker' : 'containerd') as StartOptions['runtime'];
      logger.info(`Auto runtime resolved to: ${options.runtime} (docker ${dockerFound ? 'found' : 'not found'})`);
    }

    // Resolve 'auto' vmType: krunkit if installed, otherwise vz
    if ((options.vmType as string) === 'auto') {
      let krunkitFound = false;
      try {
        const krunkitCheck = await runCommand('krunkit', ['--version'], { timeout: 5000 });
        krunkitFound = krunkitCheck.exitCode === 0;
      } catch {
        krunkitFound = false;
      }
      options.vmType = (krunkitFound ? 'krunkit' : 'vz') as StartOptions['vmType'];
      logger.info(`Auto vmType resolved to: ${options.vmType} (krunkit ${krunkitFound ? 'found' : 'not found'})`);
      if (!krunkitFound) {
        const zh = vscode.env.language.startsWith('zh');
        void vscode.window.showInformationMessage(
          zh
            ? '未检测到 krunkit，已使用 VZ 启动。AI 模型功能需要 krunkit: brew tap slp/krunkit && brew trust slp/krunkit && brew install krunkit'
            : 'krunkit not found, using VZ. AI model features require krunkit: brew tap slp/krunkit && brew trust slp/krunkit && brew install krunkit',
        );
      }
    }

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
