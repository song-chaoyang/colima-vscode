import * as vscode from 'vscode';
import { ColimaError } from '../types';
import { logger } from './logger';
import { t } from '../i18n';

export function handleError(error: unknown, context: string): void {
  let message = '';
  let detail = '';

  if (error instanceof ColimaError) {
    if (error.code === 'ENOENT') {
      message = t('notify.notInstalled');
    } else {
      message = `${context}: ${error.message}`;
      detail = error.stderr || error.message;
    }
  } else if (error instanceof Error) {
    message = `${context}: ${error.message}`;
    detail = error.message;
  } else {
    message = `${context}: ${String(error)}`;
  }

  logger.error(`${message}\n${detail}`, error);

  // Show the error with the real detail so user can see what went wrong
  void vscode.window.showErrorMessage(
    `Colima: ${message}`,
    { modal: false },
    t('misc.showOutput'),
  ).then((choice) => {
    if (choice === t('misc.showOutput')) {
      logger.show();
    }
  });
}

export async function confirmAction(message: string, detail?: string): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true, detail },
    t('confirm'),
  );
  return choice === t('confirm');
}

export async function showInfo(message: string, ...actions: string[]): Promise<string | undefined> {
  return vscode.window.showInformationMessage(`Colima: ${message}`, ...actions);
}

export async function withProgress<T>(
  title: string,
  task: (report: (message: string) => void) => Promise<T>,
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Colima: ${title}`,
      cancellable: false,
    },
    async (progress) => {
      return task((message) => progress.report({ message }));
    },
  );
}
