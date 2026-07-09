import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { ColimaProfile } from '../types';
import { TreeContextValue } from '../types';

/**
 * Tree data provider for Colima profiles.
 */
export class ProfilesTreeProvider implements vscode.TreeDataProvider<ProfileNode> {
  private _onDidChange = new vscode.EventEmitter<ProfileNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private client: ColimaClient) {}

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(element: ProfileNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProfileNode): Promise<ProfileNode[]> {
    if (element) {
      // No children for profile nodes (flat tree)
      return [];
    }

    try {
      const profiles = await this.client.listProfiles();
      if (profiles.length === 0) {
        return [];
      }
      return profiles.map((p) => new ProfileNode(p));
    } catch {
      return [];
    }
  }
}

export class ProfileNode extends vscode.TreeItem {
  constructor(public readonly profile: ColimaProfile) {
    super(
      `${profile.name}  ${profile.runtime}`,
      vscode.TreeItemCollapsibleState.None,
    );

    const memGiB = profile.memory > 0 ? Math.round(profile.memory / (1024 ** 3)) : '?';
    const diskGiB = profile.disk > 0 ? Math.round(profile.disk / (1024 ** 3)) : '?';

    this.description = `${profile.status} · ${profile.cpus}CPU · ${memGiB}G · ${diskGiB}G`;

    this.tooltip = new vscode.MarkdownString(
      `**${profile.name}**\n\n` +
      `- Status: ${profile.status}\n` +
      `- Runtime: ${profile.runtime}\n` +
      `- CPU: ${profile.cpus}\n` +
      `- Memory: ${memGiB} GiB\n` +
      `- Disk: ${diskGiB} GiB\n` +
      `- Arch: ${profile.arch}\n` +
      (profile.address ? `- Address: ${profile.address}\n` : ''),
    );

    // Set context value for menu contributions
    if (profile.status === 'Running') {
      this.contextValue = TreeContextValue.PROFILE_RUNNING;
      this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
    } else if (profile.status === 'Broken') {
      this.contextValue = TreeContextValue.PROFILE_BROKEN;
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
    } else {
      this.contextValue = TreeContextValue.PROFILE_STOPPED;
      this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
    }

    this.command = {
      command: 'colima.profile.status',
      title: 'Show Profile Status',
      arguments: [this],
    };
  }
}
