import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import { TreeContextValue } from '../types';

/**
 * Tree data provider for AI models in Colima.
 */
export class ModelsTreeProvider implements vscode.TreeDataProvider<ModelNode> {
  private _onDidChange = new vscode.EventEmitter<ModelNode | undefined>();
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

  getTreeItem(element: ModelNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ModelNode): Promise<ModelNode[]> {
    if (element) return [];

    try {
      const models = await this.client.modelList(this.activeProfile);
      if (models.length === 0) return [];
      return models.map((m) => new ModelNode(m));
    } catch {
      return [];
    }
  }
}

export class ModelNode extends vscode.TreeItem {
  constructor(modelName: string) {
    super(modelName, vscode.TreeItemCollapsibleState.None);

    this.description = 'AI Model';
    this.iconPath = new vscode.ThemeIcon('symbol-misc');
    this.contextValue = TreeContextValue.MODEL_ITEM;

    this.tooltip = new vscode.MarkdownString(
      `**${modelName}**\n\nAI Model\n\n` +
      `Right-click for actions:\n` +
      `- Run model\n` +
      `- Serve model API`,
    );

    this.command = {
      command: 'colima.model.run',
      title: 'Run Model',
      arguments: [this],
    };
  }
}
