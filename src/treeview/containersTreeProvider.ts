import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { DockerContainer } from '../types';
import { TreeContextValue } from '../types';

/**
 * Tree data provider for Docker containers running in Colima.
 */
export class ContainersTreeProvider implements vscode.TreeDataProvider<ContainerNode> {
  private _onDidChange = new vscode.EventEmitter<ContainerNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private activeProfile: string = 'default';

  constructor(private client: ColimaClient) {}

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  setActiveProfile(profile: string): void {
    this.activeProfile = profile;
    this.refresh();
  }

  getTreeItem(element: ContainerNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ContainerNode): Promise<ContainerNode[]> {
    if (element) return [];

    try {
      const containers = await this.client.getDockerContainers(this.activeProfile);
      return containers.map((c) => new ContainerNode(c));
    } catch {
      return [];
    }
  }
}

export class ContainerNode extends vscode.TreeItem {
  constructor(public readonly container: DockerContainer) {
    super(container.name, vscode.TreeItemCollapsibleState.None);

    const shortId = container.id.substring(0, 12);
    this.description = `${container.image} · ${container.status}`;

    this.tooltip = new vscode.MarkdownString(
      `**${container.name}**\n\n` +
      `- ID: ${shortId}\n` +
      `- Image: ${container.image}\n` +
      `- Status: ${container.status}\n` +
      `- State: ${container.state}\n` +
      (container.ports.length > 0 ? `- Ports: ${container.ports.join(', ')}\n` : ''),
    );

    if (container.state === 'running') {
      this.contextValue = TreeContextValue.CONTAINER_RUNNING;
      this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('testing.iconPassed'));
    } else {
      this.contextValue = TreeContextValue.CONTAINER_STOPPED;
      this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('disabledForeground'));
    }

    this.command = {
      command: 'colima.container.inspect',
      title: 'Inspect Container',
      arguments: [this],
    };
  }
}
