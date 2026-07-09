import * as vscode from 'vscode';
import type { ColimaClient, KubernetesPod } from '../colima/colimaClient';

/**
 * Tree data provider for Kubernetes pods in Colima.
 */
export class KubernetesTreeProvider implements vscode.TreeDataProvider<KubernetesNode> {
  private _onDidChange = new vscode.EventEmitter<KubernetesNode | undefined>();
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

  getTreeItem(element: KubernetesNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: KubernetesNode): Promise<KubernetesNode[]> {
    if (!element) {
      // Top-level: group by namespace
      try {
        const pods = await this.client.getKubernetesPods(this.activeProfile);
        if (pods.length === 0) return [];

        // Group by namespace
        const namespaces = new Map<string, KubernetesPod[]>();
        for (const pod of pods) {
          const ns = pod.namespace || 'default';
          if (!namespaces.has(ns)) namespaces.set(ns, []);
          namespaces.get(ns)!.push(pod);
        }

        return Array.from(namespaces.entries()).map(
          ([ns, nsPods]) => new KubernetesNode(ns, 'namespace', nsPods),
        );
      } catch {
        return [];
      }
    }

    // Namespace node → show pods
    if (element.type === 'namespace' && element.pods) {
      return element.pods.map((pod) => new KubernetesNode(pod.name, 'pod', undefined, pod));
    }

    return [];
  }
}

export class KubernetesNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly type: 'namespace' | 'pod',
    public readonly pods?: KubernetesPod[],
    public readonly pod?: KubernetesPod,
  ) {
    super(label, type === 'namespace' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

    if (type === 'namespace') {
      this.description = `${pods?.length ?? 0} pods`;
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'k8s-namespace';
    } else if (pod) {
      this.description = `${pod.status} · ${pod.ready} · ${pod.age}`;
      this.iconPath = pod.status === 'Running'
        ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'))
        : new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('problemsWarningIcon.foreground'));
      this.contextValue = 'k8s-pod';

      this.tooltip = new vscode.MarkdownString(
        `**${pod.name}**\n\n` +
        `- Namespace: ${pod.namespace}\n` +
        `- Status: ${pod.status}\n` +
        `- Ready: ${pod.ready}\n` +
        `- Restarts: ${pod.restarts}\n` +
        `- Age: ${pod.age}`,
      );

      this.command = {
        command: 'colima.container.logs',
        title: 'Show Pod Logs',
        arguments: [this],
      };
    }
  }
}
