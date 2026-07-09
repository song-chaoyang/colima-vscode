import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ColimaClient } from '../colima/colimaClient';
import { t } from '../i18n';
import { handleError, withProgress } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { runCommand } from '../utils/commandRunner';
import { ProfileNode } from '../treeview/profilesTreeProvider';

const SSH_CONFIG_PATH = path.join(os.homedir(), '.ssh', 'config');

export function registerAttachCommand(
  client: ColimaClient,
  _refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.attach', async () => {
      await attachToVM(client);
    }),
    vscode.commands.registerCommand('colima.profile.attach', async (node?: ProfileNode) => {
      await attachToVM(client, node?.profile.name);
    }),
  ];
}

async function attachToVM(client: ColimaClient, profile?: string): Promise<void> {
  try {
    // 1. Pick profile
    if (!profile) {
      const profiles = (await client.listProfiles()).filter((p) => p.status === 'Running');
      if (profiles.length === 0) {
        void vscode.window.showWarningMessage(`Colima: ${t('attach.noRunningProfiles')}`);
        return;
      }
      if (profiles.length === 1) {
        profile = profiles[0].name;
      } else {
        const items = profiles.map((p) => ({ label: p.name, description: p.runtime }));
        const choice = await vscode.window.showQuickPick(items, {
          placeHolder: t('attach.selectProfile'),
        });
        if (!choice) return;
        profile = choice.label;
      }
    }

    // 2. Check Remote-SSH extension (try multiple possible IDs for different editors)
    const remoteSSHIds = [
      'ms-vscode-remote.remote-ssh',
      'ms-vscode-remote.remote-ssh-edit',
    ];
    let remoteSSH: vscode.Extension<any> | undefined;
    for (const id of remoteSSHIds) {
      remoteSSH = vscode.extensions.getExtension(id);
      if (remoteSSH) break;
    }
    if (!remoteSSH) {
      const zh = vscode.env.language.startsWith('zh');
      const choice = await vscode.window.showWarningMessage(
        t('attach.needRemoteSSH'),
        t('attach.install'),
        zh ? '打开终端手动 SSH' : 'Open SSH Terminal Instead',
      );
      if (choice === t('attach.install')) {
        try {
          await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-vscode-remote.remote-ssh');
          void vscode.window.showInformationMessage(t('attach.installed'));
        } catch {
          void vscode.window.showErrorMessage(zh
            ? '无法安装 Remote-SSH 扩展，请手动安装后重试。'
            : 'Could not install Remote-SSH extension. Please install it manually.');
        }
      } else if (choice === (zh ? '打开终端手动 SSH' : 'Open SSH Terminal Instead')) {
        // Fallback: open SSH terminal instead
        const args = ['ssh'];
        if (profile && profile !== 'default') args.push('-p', profile);
        const terminal = vscode.window.createTerminal('Colima SSH');
        terminal.show();
        terminal.sendText(`${client.getBinaryPath()} ${args.join(' ')}`);
      }
      return;
    }

    // 3. Get SSH config and VM home dir, then open remote
    await withProgress(t('attach.attaching'), async (report) => {
      report(t('attach.gettingSSH'));
      const sshConfig = await client.sshConfig(profile);
      const hostName = parseSSHHost(sshConfig);
      if (!hostName) {
        throw new Error('Could not parse Host name from SSH config');
      }

      report(t('attach.updatingSSH'));
      ensureSSHConfig(sshConfig);

      report(t('attach.gettingHome'));
      const homeDir = await getVMHomeDir(client, profile);
      if (!homeDir) {
        throw new Error('Could not get VM home directory');
      }

      report(t('attach.openingRemote'));
      const remoteUri = vscode.Uri.parse(`vscode-remote://ssh-remote+${hostName}${homeDir}`);
      logger.info(`Opening remote workspace: ${remoteUri.toString()}`);
      try {
        await vscode.commands.executeCommand('vscode.openFolder', remoteUri, true);
      } catch (openErr) {
        // Fallback for editors that don't support vscode.openFolder with remote URIs
        logger.warn(`vscode.openFolder failed, trying alternative: ${openErr}`);
        try {
          await vscode.commands.executeCommand('vscode.open', remoteUri);
        } catch {
          throw new Error(vscode.env.language.startsWith('zh')
            ? '当前编辑器不支持远程窗口功能。已为你打开 SSH 终端作为替代。'
            : 'This editor does not support remote windows. Opening SSH terminal instead.');
        }
      }
    });
  } catch (e) {
    handleError(e, t('attach.failed'));
  }
}

function parseSSHHost(sshConfig: string): string | null {
  const match = sshConfig.match(/^Host\s+(\S+)/m);
  return match ? match[1] : null;
}

/**
 * Ensure the Colima SSH config entry exists in ~/.ssh/config.
 * Always replaces the entry to ensure the port is current (ports change on each VM restart).
 */
function ensureSSHConfig(colimaSSHConfig: string): void {
  const hostName = parseSSHHost(colimaSSHConfig);
  if (!hostName) return;

  const sshDir = path.dirname(SSH_CONFIG_PATH);
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  }

  let existingConfig = '';
  if (fs.existsSync(SSH_CONFIG_PATH)) {
    existingConfig = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
  }

  // Parse all Host blocks from existing config
  const lines = existingConfig.split('\n');
  const output: string[] = [];
  let inTargetBlock = false;
  let replaced = false;

  for (const line of lines) {
    const hostMatch = line.match(/^Host\s+(.+)$/);
    if (hostMatch) {
      // Check if this is the target host
      const hosts = hostMatch[1].trim().split(/\s+/);
      if (hosts.includes(hostName)) {
        inTargetBlock = true;
        // Replace with the new config
        output.push(colimaSSHConfig.trim());
        replaced = true;
        continue;
      }
      inTargetBlock = false;
    }

    if (!inTargetBlock) {
      output.push(line);
    }
  }

  if (!replaced) {
    // Append new entry
    if (output.length > 0 && output[output.length - 1].trim() !== '') {
      output.push('');
    }
    output.push(colimaSSHConfig.trim());
    output.push('');
  }

  const newConfig = output.join('\n');
  fs.writeFileSync(SSH_CONFIG_PATH, newConfig, 'utf-8');
  logger.info(`Updated SSH config entry for "${hostName}"`);
}

async function getVMHomeDir(client: ColimaClient, profile?: string): Promise<string | null> {
  try {
    const args = ['ssh'];
    if (profile && profile !== 'default') args.push('-p', profile);
    args.push('--', 'bash', '-c', 'echo $HOME');
    const result = await runCommand(client.getBinaryPath(), args, { timeout: 15000 });
    if (result.exitCode === 0) {
      const home = result.stdout.trim().split('\n').pop()?.trim();
      if (home && home.startsWith('/')) return home;
    }
  } catch (e) {
    logger.debug(`Failed to get VM home dir: ${e}`);
  }
  // Fallback: derive from SSH config user
  try {
    const sshConfig = await client.sshConfig(profile);
    const userMatch = sshConfig.match(/^\s*User\s+(\S+)/m);
    if (userMatch) return `/home/${userMatch[1]}`;
  } catch { /* ignore */ }
  return '/root';
}
