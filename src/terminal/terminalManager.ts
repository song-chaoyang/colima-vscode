import * as vscode from 'vscode';
import * as path from 'path';
import { getColimaHome, runCommand } from '../utils/commandRunner';
import type { ColimaClient } from '../colima/colimaClient';

/**
 * Manages integrated terminal sessions for Colima operations.
 */
export class TerminalManager implements vscode.Disposable {
  private terminals: Map<string, vscode.Terminal> = new Map();
  private client: ColimaClient;

  constructor(client: ColimaClient) {
    this.client = client;
  }

  /** Open an SSH terminal into the Colima VM */
  openSSH(profile?: string): vscode.Terminal {
    const name = `Colima SSH${profile ? ` (${profile})` : ''}`;
    const existing = this.terminals.get(name);
    if (existing && existing.exitStatus === undefined) {
      existing.show();
      return existing;
    }

    const args = profile && profile !== 'default'
      ? ['ssh', '-p', profile]
      : ['ssh'];

    const terminal = vscode.window.createTerminal(name, this.client.getBinaryPath(), args);
    terminal.show();
    this.terminals.set(name, terminal);
    return terminal;
  }

  /** Open a terminal with the Docker environment configured for a Colima profile */
  openDockerShell(profile?: string): vscode.Terminal {
    const name = `Docker Shell${profile ? ` (${profile})` : ''}`;
    const socketPath = path.join(getColimaHome(), profile ?? 'default', 'docker.sock');

    const env = { DOCKER_HOST: `unix://${socketPath}` };
    const options: vscode.TerminalOptions = {
      name,
      env,
    };

    const terminal = vscode.window.createTerminal(options);
    terminal.show();
    terminal.sendText(`echo "Docker context: ${socketPath}" && docker ps`);
    this.terminals.set(name, terminal);
    return terminal;
  }

  /** Run a command in a terminal */
  runCommand(title: string, command: string, args?: string[]): vscode.Terminal {
    const terminal = vscode.window.createTerminal({
      name: `Colima: ${title}`,
      pty: undefined,
    });
    terminal.show();
    if (args && args.length > 0) {
      terminal.sendText(`${command} ${args.join(' ')}`);
    } else {
      terminal.sendText(command);
    }
    return terminal;
  }

  /** Run a colima command in a terminal with streaming output */
  runColimaCommand(args: string[], title: string): vscode.Terminal {
    const terminal = vscode.window.createTerminal({
      name: `Colima: ${title}`,
    });
    terminal.show();
    const cmd = `${this.client.getBinaryPath()} ${args.join(' ')}`;
    terminal.sendText(cmd);
    return terminal;
  }

  /** Show container logs in a terminal */
  showContainerLogs(containerId: string, profile?: string): vscode.Terminal {
    const socketPath = path.join(getColimaHome(), profile ?? 'default', 'docker.sock');
    const name = `Logs: ${containerId.substring(0, 12)}`;
    const terminal = vscode.window.createTerminal({
      name,
      env: { DOCKER_HOST: `unix://${socketPath}` },
    });
    terminal.show();
    terminal.sendText(`docker logs -f ${containerId}`);
    return terminal;
  }

  /** Exec into a container */
  execContainer(containerId: string, profile?: string): vscode.Terminal {
    const socketPath = path.join(getColimaHome(), profile ?? 'default', 'docker.sock');
    const name = `Exec: ${containerId.substring(0, 12)}`;
    const terminal = vscode.window.createTerminal({
      name,
      env: { DOCKER_HOST: `unix://${socketPath}` },
    });
    terminal.show();
    terminal.sendText(`docker exec -it ${containerId} /bin/sh`);
    return terminal;
  }

  /** Inspect a container in a new editor */
  async inspectContainer(containerId: string, profile?: string): Promise<void> {
    const socketPath = path.join(getColimaHome(), profile ?? 'default', 'docker.sock');
    const result = await runCommand('docker', ['inspect', containerId], {
      env: { DOCKER_HOST: `unix://${socketPath}` },
    });
    if (result.exitCode === 0) {
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(JSON.parse(result.stdout), null, 2),
        language: 'json',
      });
      await vscode.window.showTextDocument(doc);
    }
  }

  dispose(): void {
    this.terminals.forEach((t) => t.dispose());
    this.terminals.clear();
  }
}
