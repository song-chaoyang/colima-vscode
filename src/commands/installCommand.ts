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
 * Check if a binary exists by trying common paths and PATH.
 */
function findBinary(name: string): string | null {
  const platform = process.platform;
  const paths: string[] = [];

  if (platform === 'darwin') {
    paths.push('/opt/homebrew/bin/' + name, '/usr/local/bin/' + name);
  } else if (platform === 'linux') {
    paths.push('/home/linuxbrew/.linuxbrew/bin/' + name, '/usr/local/bin/' + name, '/usr/bin/' + name);
  }
  // For Windows, wsl.exe is in System32 which is always in PATH
  paths.push(name);

  for (const p of paths) {
    if (p === name) return name; // Trust PATH
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch { /* not found */ }
  }
  return null;
}

/**
 * Get the official binary download command for the current platform.
 * Based on https://colima.run/docs/installation/
 */
function getBinaryDownloadCmd(platform: string): string {
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

  return `curl -LO https://github.com/abiosoft/colima/releases/latest/download/colima-${osName}-${archName} && sudo install colima-${osName}-${archName} /usr/local/bin/colima`;
}

async function installColima(client: ColimaClient, refreshCallback: () => void): Promise<void> {
  const zh = vscode.env.language.startsWith('zh');
  const platform = process.platform;

  let installCmd: string;
  let title: string;

  if (platform === 'darwin' || platform === 'linux') {
    // macOS / Linux: check if Homebrew is installed
    const brewPath = findBinary('brew');
    if (brewPath) {
      // Homebrew is available — use it (recommended method)
      installCmd = `${brewPath} install colima docker`;
      title = zh ? '安装 Colima (Homebrew)' : 'Install Colima (Homebrew)';
    } else {
      // No Homebrew — use official binary download method
      // https://colima.run/docs/installation/#manual-installation
      installCmd = getBinaryDownloadCmd(platform);
      title = zh ? '安装 Colima (官方二进制下载)' : 'Install Colima (Official Binary Download)';

      // Show a hint about Homebrew
      void vscode.window.showInformationMessage(
        zh
          ? '未检测到 Homebrew，将使用官方二进制下载方式安装。如需更便捷的安装，可先安装 Homebrew: https://brew.sh'
          : 'Homebrew not found, using official binary download. For easier installation, consider installing Homebrew: https://brew.sh',
      );
    }
  } else if (platform === 'win32') {
    // Windows: Colima requires WSL2
    // Check if WSL is available
    const wslPath = findBinary('wsl');
    if (!wslPath) {
      // No WSL — Colima cannot run on Windows without WSL
      const msg = zh
        ? '⚠️ Colima 在 Windows 上需要 WSL2。\n\n请先安装 WSL2：\n1. 以管理员身份打开 PowerShell\n2. 运行: wsl --install\n3. 重启电脑\n4. 重新打开 VS Code 并再次点击安装\n\n详细教程: https://learn.microsoft.com/windows/wsl/install'
        : '⚠️ Colima requires WSL2 on Windows.\n\nTo install WSL2:\n1. Open PowerShell as Administrator\n2. Run: wsl --install\n3. Restart your computer\n4. Reopen VS Code and try again\n\nGuide: https://learn.microsoft.com/windows/wsl/install';
      void vscode.window.showErrorMessage(msg, zh ? '打开教程' : 'Open Guide').then((choice) => {
        if (choice) {
          void vscode.env.openExternal(vscode.Uri.parse('https://learn.microsoft.com/windows/wsl/install'));
        }
      });
      return;
    }

    // WSL is available — check if Homebrew is installed inside WSL
    // We can't easily check, so just try brew first, then binary download
    title = zh ? '安装 Colima (WSL)' : 'Install Colima (WSL)';
    // Use a compound command: try brew, if not found, use binary download
    installCmd = `wsl bash -c "command -v brew >/dev/null 2>&1 && brew install colima docker || (curl -LO https://github.com/abiosoft/colima/releases/latest/download/colima-Linux-$(uname -m) && sudo install colima-Linux-$(uname -m) /usr/local/bin/colima)"`;
  } else {
    void vscode.window.showErrorMessage(
      zh ? `不支持的平台: ${platform}` : `Unsupported platform: ${platform}`,
    );
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
