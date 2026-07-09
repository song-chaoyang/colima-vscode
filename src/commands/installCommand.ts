import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import type { ColimaClient } from '../colima/colimaClient';

export function registerInstallCommand(
  client: ColimaClient,
  refreshCallback: () => void,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('colima.install', async () => {
      try {
        await installColima(client, refreshCallback);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Colima: ${msg}`);
        logger.error(`Install error: ${msg}`, e);
      }
    }),
  ];
}

/**
 * Check if a binary exists by trying common paths.
 */
function findBinary(name: string): string | null {
  const platform = process.platform;
  const paths: string[] = [];

  if (platform === 'darwin') {
    paths.push('/opt/homebrew/bin/' + name, '/usr/local/bin/' + name);
  } else if (platform === 'linux') {
    paths.push('/home/linuxbrew/.linuxbrew/bin/' + name, '/usr/local/bin/' + name, '/usr/bin/' + name);
  } else if (platform === 'win32') {
    paths.push(path.join(os.homedir(), 'scoop', 'shims', name + '.exe'));
  }
  paths.push(name); // Rely on PATH

  for (const p of paths) {
    if (p === name) return name; // Trust PATH
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch { /* not found */ }
  }
  return null;
}

async function installColima(client: ColimaClient, refreshCallback: () => void): Promise<void> {
  const zh = vscode.env.language.startsWith('zh');
  const platform = process.platform;

  // Determine install command based on platform
  let installCmd: string;
  let title: string;

  if (platform === 'darwin' || platform === 'linux') {
    // Check if Homebrew is available
    const brewPath = findBinary('brew');
    if (brewPath) {
      installCmd = `${brewPath} install colima docker`;
      title = zh ? '安装 Colima (Homebrew)' : 'Install Colima (Homebrew)';
    } else {
      // Use binary download — official method from colima.run/docs/installation
      const arch = process.arch;
      let osName: string;
      let archName: string;
      if (platform === 'darwin') {
        osName = 'Darwin';
        archName = arch === 'arm64' ? 'arm64' : 'x86_64';
      } else {
        osName = 'Linux';
        archName = arch === 'arm64' ? 'aarch64' : 'x86_64';
      }
      installCmd = `curl -LO https://github.com/abiosoft/colima/releases/latest/download/colima-${osName}-${archName} && sudo install colima-${osName}-${archName} /usr/local/bin/colima`;
      title = zh ? '安装 Colima (二进制下载)' : 'Install Colima (Binary Download)';
    }
  } else if (platform === 'win32') {
    const wslPath = findBinary('wsl');
    if (wslPath) {
      installCmd = `${wslPath} brew install colima docker`;
      title = zh ? '安装 Colima (WSL)' : 'Install Colima (WSL)';
    } else {
      void vscode.window.showErrorMessage(
        zh
          ? 'Windows 上需要先安装 WSL2。请运行: wsl --install，然后重启后再试。'
          : 'WSL2 is required on Windows. Run: wsl --install, then restart and retry.',
      );
      await vscode.env.openExternal(vscode.Uri.parse('https://learn.microsoft.com/windows/wsl/install'));
      return;
    }
  } else {
    void vscode.window.showErrorMessage(`Unsupported platform: ${platform}`);
    return;
  }

  // Show info message BEFORE opening terminal
  void vscode.window.showInformationMessage(
    zh ? `Colima: 正在打开终端执行安装...` : `Colima: Opening terminal to install...`,
  );

  // Open terminal and run install command
  const terminal = vscode.window.createTerminal(title);
  terminal.show();

  // Small delay to ensure terminal is visible
  await new Promise(resolve => setTimeout(resolve, 200));

  // Run the install command
  terminal.sendText(installCmd);
  logger.info(`Installing Colima: ${installCmd}`);

  // Show notification
  void vscode.window.showInformationMessage(
    zh
      ? `Colima: 安装命令已在终端执行。安装完成后请重新加载窗口。`
      : `Colima: Install command is running in the terminal. Reload the window after installation completes.`,
  );

  // Poll for completion every 5 seconds, up to 5 minutes
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const installed = await client.isInstalled();
      if (installed) {
        clearInterval(interval);
        await vscode.commands.executeCommand('setContext', 'colima.installed', true);
        void vscode.window.showInformationMessage(
          zh ? '✅ Colima 安装成功！' : '✅ Colima installed successfully!',
        );
        refreshCallback();
      } else if (attempts >= 60) {
        clearInterval(interval);
      }
    } catch { /* ignore */ }
  }, 5000);
}
