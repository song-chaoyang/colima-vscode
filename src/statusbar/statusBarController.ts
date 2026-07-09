import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { t } from '../i18n';
import { CMD, STATUS_BAR_PRIORITY } from '../constants';
import type { ColimaClient } from '../colima/colimaClient';
import type { ColimaProfile } from '../types';

export class StatusBarController implements vscode.Disposable {
  private statusItem: vscode.StatusBarItem;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private client: ColimaClient;
  private disposables: vscode.Disposable[] = [];
  private activeProfile: string = 'default';

  constructor(client: ColimaClient) {
    this.client = client;
    this.statusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_PRIORITY,
    );
    this.statusItem.command = CMD.STATUS;
    this.disposables.push(this.statusItem);
  }

  start(): void {
    this.updateConfig();
    this.refresh();
    this.startAutoRefresh();
  }

  updateConfig(): void {
    const config = vscode.workspace.getConfiguration('colima');
    if (config.get<boolean>('showStatusBarItem', true)) {
      this.statusItem.show();
    } else {
      this.statusItem.hide();
    }
  }

  private startAutoRefresh(): void {
    const config = vscode.workspace.getConfiguration('colima');
    if (!config.get<boolean>('autoRefresh', true)) return;
    const interval = config.get<number>('refreshInterval', 10) * 1000;
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((e) => logger.debug(`Auto-refresh error: ${e}`));
    }, interval);
  }

  async refresh(): Promise<void> {
    try {
      const profiles = await this.client.listProfiles();
      const active = profiles.find((p) => p.name === this.activeProfile) ?? profiles[0];
      if (!active) {
        this.setStatusStopped();
        return;
      }
      this.activeProfile = active.name;
      if (active.status === 'Running') {
        this.setStatusRunning(active);
      } else if (active.status === 'Broken') {
        this.setStatusBroken(active);
      } else {
        this.setStatusStopped(active);
      }
    } catch {
      this.setStatusError();
    }
  }

  private setStatusRunning(profile: ColimaProfile): void {
    const memGiB = profile.memory > 0 ? Math.round(profile.memory / (1024 ** 3)) : 0;
    this.statusItem.text = `$(circle-filled) Colima: ${profile.name} (${profile.cpus}CPU/${memGiB}G)`;
    this.statusItem.tooltip = new vscode.MarkdownString(
      `**Colima: ${profile.name}**\n\n` +
      `Status: ${t('status.running')}\n` +
      `Runtime: ${profile.runtime}\n` +
      `CPU: ${profile.cpus}\n` +
      `Memory: ${memGiB} GiB\n` +
      `Disk: ${profile.disk > 0 ? Math.round(profile.disk / (1024 ** 3)) : '?'} GiB\n` +
      `Arch: ${profile.arch}\n\n` +
      `Click for details`,
    );
    this.statusItem.backgroundColor = undefined;
  }

  private setStatusStopped(profile?: ColimaProfile): void {
    const name = profile?.name ?? 'default';
    this.statusItem.text = `$(circle-slash) Colima: ${name}`;
    this.statusItem.tooltip = new vscode.MarkdownString(
      `**Colima: ${name}**\n\nStatus: ${t('status.stopped')}\n\nClick to show status`,
    );
    this.statusItem.backgroundColor = undefined;
  }

  private setStatusBroken(profile: ColimaProfile): void {
    this.statusItem.text = `$(warning) Colima: ${profile.name} (${t('status.broken')})`;
    this.statusItem.tooltip = new vscode.MarkdownString(
      `**Colima: ${profile.name}**\n\nStatus: ${t('status.broken')}\n\nClick to view details`,
    );
    this.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  private setStatusError(): void {
    this.statusItem.text = `$(error) Colima: ${t('status.error')}`;
    this.statusItem.tooltip = new vscode.MarkdownString(
      `**Colima**\n\n${t('notify.notInstalled')}\n\nClick for help`,
    );
    this.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  setActiveProfile(profile: string): void {
    this.activeProfile = profile;
    this.refresh().catch(() => {});
  }

  dispose(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.disposables.forEach((d) => d.dispose());
  }
}
