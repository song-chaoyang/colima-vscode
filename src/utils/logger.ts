import * as vscode from 'vscode';

class Logger {
  private outputChannel: vscode.OutputChannel | undefined;
  private verbose: boolean = false;

  init(context: vscode.ExtensionContext): void {
    this.outputChannel = vscode.window.createOutputChannel('Colima');
    context.subscriptions.push(this.outputChannel);
    this.updateVerboseSetting();
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  updateVerboseSetting(): void {
    const config = vscode.workspace.getConfiguration('colima');
    this.verbose = config.get<boolean>('verboseLogging', false);
  }

  info(message: string): void {
    const line = `[INFO] ${new Date().toISOString()} ${message}`;
    this.outputChannel?.appendLine(line);
    if (this.verbose) {
      console.log(`[Colima] ${line}`);
    }
  }

  warn(message: string): void {
    const line = `[WARN] ${new Date().toISOString()} ${message}`;
    this.outputChannel?.appendLine(line);
    console.warn(`[Colima] ${line}`);
  }

  error(message: string, error?: unknown): void {
    const errStr = error instanceof Error ? error.message : String(error ?? '');
    const line = `[ERROR] ${new Date().toISOString()} ${message}${errStr ? ' — ' + errStr : ''}`;
    this.outputChannel?.appendLine(line);
    console.error(`[Colima] ${line}`);
  }

  debug(message: string): void {
    if (!this.verbose) return;
    const line = `[DEBUG] ${new Date().toISOString()} ${message}`;
    this.outputChannel?.appendLine(line);
  }

  show(): void {
    this.outputChannel?.show();
  }

  showErrorMessage(message: string, error?: unknown): void {
    this.error(message, error);
    const errStr = error instanceof Error ? `: ${error.message}` : '';
    void vscode.window.showErrorMessage(`Colima: ${message}${errStr}`, 'Show Output').then((choice) => {
      if (choice === 'Show Output') {
        this.show();
      }
    });
  }
}

export const logger = new Logger();
