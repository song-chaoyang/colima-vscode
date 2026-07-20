import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { runCommand } from '../utils/commandRunner';
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
 * Check if a command exists by running it with --version.
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const result = await runCommand(cmd, ['--version'], { timeout: 10000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the official binary download commands for the current platform.
 * Returns an array of commands to run sequentially in the terminal.
 * Split into separate commands to avoid sudo password corrupting && chains.
 * Based on https://colima.run/docs/installation/#manual-installation
 */
function getBinaryDownloadCmds(platform: string): string[] {
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

  const fileName = `colima-${osName}-${archName}`;
  const url = `https://github.com/abiosoft/colima/releases/latest/download/${fileName}`;

  // Determine the install directory:
  // - Try /usr/local/bin first (standard, requires sudo)
  // - If that doesn't exist, try /opt/homebrew/bin (Apple Silicon)
  // - If neither exists, use ~/.local/bin (no sudo needed, usually in PATH)
  const homeDir = require('os').homedir();
  let installDir: string;
  try {
    require('fs').accessSync('/usr/local/bin', require('fs').constants.W_OK);
    installDir = '/usr/local/bin';
  } catch {
    try {
      require('fs').accessSync('/opt/homebrew/bin', require('fs').constants.W_OK);
      installDir = '/opt/homebrew/bin';
    } catch {
      // Fallback: ~/.local/bin (create if needed, no sudo)
      installDir = `${homeDir}/.local/bin`;
    }
  }

  const needsSudo = installDir.startsWith('/usr/') || installDir.startsWith('/opt/');

  const cmds: string[] = [
    `curl -LO ${url}`,
  ];

  if (needsSudo) {
    cmds.push(`sudo mkdir -p ${installDir}`);
    cmds.push(`sudo cp ${fileName} ${installDir}/colima`);
    cmds.push(`sudo chmod +x ${installDir}/colima`);
  } else {
    cmds.push(`mkdir -p ${installDir}`);
    cmds.push(`cp ${fileName} ${installDir}/colima`);
    cmds.push(`chmod +x ${installDir}/colima`);
  }

  cmds.push(`rm -f ${fileName}`);

  return cmds;
}

async function installColima(client: ColimaClient, refreshCallback: () => void): Promise<void> {
  const zh = vscode.env.language.startsWith('zh');
  const platform = process.platform;

  // installCmds: array of commands to run sequentially in the terminal
  let installCmds: string[];
  let title: string;

  if (platform === 'darwin' || platform === 'linux') {
    // macOS / Linux: check if Homebrew is actually working
    // Run `brew --version` to verify
    const brewWorking = await commandExists('brew');
    if (brewWorking) {
      // Homebrew is available — use it (recommended method)
      installCmds = ['brew install colima docker'];
      title = zh ? '安装 Colima (Homebrew)' : 'Install Colima (Homebrew)';
      logger.info('Homebrew detected (brew --version succeeded), using brew install');
    } else {
      // No Homebrew — use official binary download
      // https://colima.run/docs/installation/#manual-installation
      installCmds = getBinaryDownloadCmds(platform);
      title = zh ? '安装 Colima (官方二进制下载)' : 'Install Colima (Official Binary Download)';
      logger.info('Homebrew not found (brew --version failed), using official binary download');

      void vscode.window.showInformationMessage(
        zh
          ? '未检测到 Homebrew (brew --version 失败)，将使用官方二进制下载方式安装 Colima。'
          : 'Homebrew not detected (brew --version failed), using official binary download to install Colima.',
      );
    }
  } else if (platform === 'win32') {
    // Windows: Colima requires WSL2
    // Step 1: Check if WSL is available
    const wslWorking = await commandExists('wsl');
    if (!wslWorking) {
      // No WSL — Colima cannot run on Windows without WSL
      const msg = zh
        ? '⚠️ Colima 在 Windows 上需要 WSL2。\n\n请先安装 WSL2：\n1. 以管理员身份打开 PowerShell\n2. 运行: wsl --install\n3. 重启电脑\n4. 重新打开 VS Code 并再次点击安装\n\n详细教程: https://learn.microsoft.com/windows/wsl/install'
        : '⚠️ Colima requires WSL2 on Windows.\n\nTo install WSL2:\n1. Open PowerShell as Administrator\n2. Run: wsl --install\n3. Restart your computer\n4. Reopen VS Code and try again\n\nGuide: https://learn.microsoft.com/windows/wsl/install';
      const action = zh ? '打开教程' : 'Open Guide';
      const choice = await vscode.window.showErrorMessage(msg, action);
      if (choice === action) {
        await vscode.env.openExternal(vscode.Uri.parse('https://learn.microsoft.com/windows/wsl/install'));
      }
      return;
    }

    // Step 2: WSL is available — check if Homebrew is installed inside WSL
    // Run `wsl bash -c "command -v brew"` to check
    const wslBrewResult = await runCommand('wsl', ['bash', '-c', 'command -v brew'], { timeout: 10000 });
    const wslHasBrew = wslBrewResult.exitCode === 0 && wslBrewResult.stdout.trim().length > 0;

    title = zh ? '安装 Colima (WSL)' : 'Install Colima (WSL)';

    if (wslHasBrew) {
      // Homebrew is available in WSL — use it
      installCmds = ['wsl brew install colima docker'];
      logger.info('WSL + Homebrew detected, using wsl brew install');
    } else {
      // No Homebrew in WSL — use binary download inside WSL
      // Use ~/.local/bin to avoid sudo issues, fallback to /usr/local/bin with sudo
      installCmds = [
        'wsl bash -c "curl -LO https://github.com/abiosoft/colima/releases/latest/download/colima-Linux-$(uname -m)"',
        'wsl bash -c "mkdir -p ~/.local/bin && cp colima-Linux-$(uname -m) ~/.local/bin/colima && chmod +x ~/.local/bin/colima && rm -f colima-Linux-$(uname -m)"',
      ];
      logger.info('WSL detected but no Homebrew, using binary download in WSL (~/.local/bin)');

      void vscode.window.showInformationMessage(
        zh
          ? 'WSL 中未检测到 Homebrew，将使用官方二进制下载方式在 WSL 中安装 Colima。'
          : 'Homebrew not found in WSL, using official binary download inside WSL.',
      );
    }
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

  // Open terminal
  const terminal = vscode.window.createTerminal(title);
  terminal.show();

  // Small delay to ensure terminal is visible
  await new Promise(resolve => setTimeout(resolve, 300));

  // Run each command sequentially in the terminal
  for (let i = 0; i < installCmds.length; i++) {
    terminal.sendText(installCmds[i]);
    logger.info(`Install step ${i + 1}/${installCmds.length}: ${installCmds[i]}`);

    // If this is a sudo command, wait longer for password input
    if (installCmds[i].includes('sudo')) {
      // Wait for user to enter password and command to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      // Short delay between non-sudo commands
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Show notification
  void vscode.window.showInformationMessage(
    zh
      ? `Colima: 安装命令已在终端执行 (${installCmds.length} 步)。安装完成后请重新加载窗口。`
      : `Colima: Install commands are running in the terminal (${installCmds.length} steps). Reload the window after installation completes.`,
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

        // Check if Docker CLI is also installed (required for docker runtime)
        const dockerInstalled = await commandExists('docker');
        if (!dockerInstalled) {
          const msg = zh
            ? '检测到未安装 Docker CLI。Colima 的 docker 运行时需要 Docker 命令行工具。是否现在安装？'
            : 'Docker CLI not detected. Colima docker runtime requires the docker command-line tool. Install now?';
          const action = zh ? '安装 Docker CLI' : 'Install Docker CLI';
          const choice = await vscode.window.showWarningMessage(msg, action);
          if (choice === action) {
            await installDockerCli(platform, zh);
          }
        }
      } else if (attempts >= 60) {
        clearInterval(interval);
      }
    } catch { /* ignore */ }
  }, 5000);
}

/**
 * Install Docker CLI on the current platform.
 * macOS/Linux: brew install docker, or binary download from docker.com
 */
async function installDockerCli(platform: string, zh: boolean): Promise<void> {
  let cmds: string[];
  let title: string;

  if (platform === 'darwin' || platform === 'linux') {
    const brewWorking = await commandExists('brew');
    if (brewWorking) {
      cmds = ['brew install docker'];
      title = zh ? '安装 Docker CLI (Homebrew)' : 'Install Docker CLI (Homebrew)';
    } else {
      // Download Docker CLI binary from docker.com
      const arch = process.arch;
      let dockerArch: string;
      if (platform === 'darwin') {
        dockerArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
      } else {
        dockerArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
      }

      // Get latest Docker version
      cmds = [
        `curl -fsSL https://download.docker.com/${platform === 'darwin' ? 'mac' : 'linux'}/static/stable/${dockerArch}/docker-28.0.0.tgz -o docker.tgz`,
        `tar xzf docker.tgz`,
        `mkdir -p ~/.local/bin && cp docker/docker ~/.local/bin/ && chmod +x ~/.local/bin/docker`,
        `rm -rf docker docker.tgz`,
      ];
      title = zh ? '安装 Docker CLI (二进制下载)' : 'Install Docker CLI (Binary Download)';
    }
  } else if (platform === 'win32') {
    cmds = ['wsl bash -c "command -v brew >/dev/null 2>&1 && brew install docker || (curl -fsSL https://download.docker.com/linux/static/stable/$(uname -m)/docker-28.0.0.tgz -o docker.tgz && tar xzf docker.tgz && mkdir -p ~/.local/bin && cp docker/docker ~/.local/bin/ && chmod +x ~/.local/bin/docker && rm -rf docker docker.tgz)"'];
    title = zh ? '安装 Docker CLI (WSL)' : 'Install Docker CLI (WSL)';
  } else {
    return;
  }

  void vscode.window.showInformationMessage(
    zh ? `Colima: 正在打开终端安装 Docker CLI...` : `Colima: Opening terminal to install Docker CLI...`,
  );

  const terminal = vscode.window.createTerminal(title);
  terminal.show();
  await new Promise(resolve => setTimeout(resolve, 300));

  for (let i = 0; i < cmds.length; i++) {
    terminal.sendText(cmds[i]);
    logger.info(`Docker CLI install step ${i + 1}/${cmds.length}: ${cmds[i]}`);
    if (cmds[i].includes('sudo')) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  void vscode.window.showInformationMessage(
    zh
      ? `Colima: Docker CLI 安装命令已在终端执行。安装完成后请重新加载窗口。`
      : `Colima: Docker CLI install commands are running in the terminal. Reload the window after installation completes.`,
  );
}
