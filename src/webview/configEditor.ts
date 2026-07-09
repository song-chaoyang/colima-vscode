import * as vscode from 'vscode';
import { configManager } from '../colima/colimaConfig';
import type { ColimaConfig } from '../types';
import { handleError } from '../utils/errorHandler';

/**
 * Webview panel for visually editing a Colima configuration.
 */
export class ConfigEditor {
  private panel: vscode.WebviewPanel | undefined;

  show(profile: string): void {
    if (this.panel) {
      this.panel.dispose();
    }

    const config = configManager.loadConfig(profile) ?? configManager.getDefaultConfig();
    const immutable = configManager.getImmutableKeys();

    this.panel = vscode.window.createWebviewPanel(
      'colimaConfigEditor',
      `Colima Config: ${profile}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = this.getHtml(config, profile, immutable);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'save': {
            try {
              const updated = this.formToConfig(message.config, config);
              configManager.saveConfig(profile, updated);
              void vscode.window.showInformationMessage(`Colima: Configuration saved for "${profile}"`);
              this.panel?.dispose();
            } catch (e) {
              handleError(e, 'Failed to save configuration');
            }
            break;
          }
          case 'cancel': {
            this.panel?.dispose();
            break;
          }
        }
      },
      undefined,
      [],
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private formToConfig(form: any, original: ColimaConfig): ColimaConfig {
    return {
      ...original,
      cpu: form.cpu ?? original.cpu,
      memory: form.memory ?? original.memory,
      disk: form.disk ?? original.disk,
      arch: form.arch ?? original.arch,
      runtime: form.runtime ?? original.runtime,
      vmType: form.vmType ?? original.vmType,
      mountType: form.mountType ?? original.mountType,
      autoActivate: form.autoActivate ?? original.autoActivate,
      forwardAgent: form.forwardAgent ?? original.forwardAgent,
      rosetta: form.rosetta ?? original.rosetta,
      binfmt: form.binfmt ?? original.binfmt,
      nestedVirtualization: form.nestedVirtualization ?? original.nestedVirtualization,
      sshConfig: form.sshConfig ?? original.sshConfig,
      sshPort: form.sshPort ?? original.sshPort,
      rootDisk: form.rootDisk ?? original.rootDisk,
      hostname: form.hostname ?? original.hostname,
      kubernetes: {
        enabled: form.k8sEnabled ?? original.kubernetes.enabled,
        version: form.k8sVersion ?? original.kubernetes.version,
        k3sArgs: original.kubernetes.k3sArgs,
        port: form.k8sPort ?? original.kubernetes.port,
      },
      network: {
        ...original.network,
        address: form.netAddress ?? original.network.address,
        mode: form.netMode ?? original.network.mode,
      },
    };
  }

  private getHtml(config: ColimaConfig, profile: string, immutable: string[]): string {
    const isImmutable = (key: string) => immutable.includes(key);
    const disabled = (key: string) => isImmutable(key) ? 'disabled' : '';
    const immutableNote = (key: string) =>
      isImmutable(key) ? '<span class="immutable-note">⚠ Immutable (set at creation)</span>' : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Colima Config Editor: ${profile}</title>
<style>
  body {
    font-family: var(--vscode-font-family, -apple-system, sans-serif);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 24px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 { font-size: 1.4em; margin-bottom: 4px; }
  .subtitle { color: var(--vscode-descriptionForeground); margin-bottom: 20px; }

  .section {
    border: 1px solid var(--vscode-editorWidget-border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .section h2 {
    font-size: 1em;
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-editorWidget-border);
  }

  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-group { margin-bottom: 8px; }
  .form-group label {
    display: block; font-size: 12px; margin-bottom: 4px;
    color: var(--vscode-descriptionForeground);
  }
  .form-group input, .form-group select {
    width: 100%;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    color: var(--vscode-input-foreground);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    box-sizing: border-box;
  }
  .form-group input:disabled, .form-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .immutable-note { font-size: 10px; color: var(--vscode-descriptionForeground); display: block; }

  .toggle-row { display: flex; align-items: center; gap: 8px; }
  .toggle-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--vscode-button-background); }

  .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; padding: 8px 24px;
    border-radius: 4px; cursor: pointer;
    font-size: 13px; font-weight: 600;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
</style>
</head>
<body>
<h1>Colima Configuration: ${profile}</h1>
<p class="subtitle">Edit configuration visually. Click Save to apply.</p>

<div class="section">
  <h2>💾 Resources</h2>
  <div class="form-grid">
    <div class="form-group">
      <label>CPU Cores ${immutableNote('cpu')}</label>
      <input type="number" id="cpu" value="${config.cpu}" min="1" max="16" ${disabled('cpu')}>
    </div>
    <div class="form-group">
      <label>Memory (GB) ${immutableNote('memory')}</label>
      <input type="number" id="memory" value="${config.memory}" min="1" max="64">
    </div>
    <div class="form-group">
      <label>Disk Size (GB)</label>
      <input type="number" id="disk" value="${config.disk}" min="10" max="1000">
    </div>
    <div class="form-group">
      <label>Root Disk (GB)</label>
      <input type="number" id="rootDisk" value="${config.rootDisk}" min="5" max="500">
    </div>
  </div>
</div>

<div class="section">
  <h2>⚙️ Runtime</h2>
  <div class="form-grid">
    <div class="form-group">
      <label>Runtime ${immutableNote('runtime')}</label>
      <select id="runtime" ${disabled('runtime')}>
        <option value="docker" ${config.runtime === 'docker' ? 'selected' : ''}>Docker</option>
        <option value="containerd" ${config.runtime === 'containerd' ? 'selected' : ''}>Containerd</option>
        <option value="incus" ${config.runtime === 'incus' ? 'selected' : ''}>Incus</option>
      </select>
    </div>
    <div class="form-group">
      <label>VM Type ${immutableNote('vmType')}</label>
      <select id="vmType" ${disabled('vmType')}>
        <option value="vz" ${config.vmType === 'vz' ? 'selected' : ''}>VZ (Apple Virtualization)</option>
        <option value="qemu" ${config.vmType === 'qemu' ? 'selected' : ''}>QEMU</option>
        <option value="krunkit" ${config.vmType === 'krunkit' ? 'selected' : ''}>Krunkit (GPU)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Mount Type ${immutableNote('mountType')}</label>
      <select id="mountType" ${disabled('mountType')}>
        <option value="virtiofs" ${config.mountType === 'virtiofs' ? 'selected' : ''}>VirtioFS</option>
        <option value="9p" ${config.mountType === '9p' ? 'selected' : ''}>9p</option>
        <option value="sshfs" ${config.mountType === 'sshfs' ? 'selected' : ''}>SSHFS</option>
      </select>
    </div>
    <div class="form-group">
      <label>Architecture ${immutableNote('arch')}</label>
      <select id="arch" ${disabled('arch')}>
        <option value="host" ${config.arch === 'host' ? 'selected' : ''}>Host (auto)</option>
        <option value="aarch64" ${config.arch === 'aarch64' ? 'selected' : ''}>ARM64</option>
        <option value="x86_64" ${config.arch === 'x86_64' ? 'selected' : ''}>x86_64</option>
      </select>
    </div>
  </div>
</div>

<div class="section">
  <h2>☸️ Kubernetes</h2>
  <div class="form-grid">
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="k8sEnabled" ${config.kubernetes.enabled ? 'checked' : ''}>
        <label for="k8sEnabled">Enable Kubernetes</label>
      </div>
    </div>
    <div class="form-group">
      <label>K3s Version</label>
      <input type="text" id="k8sVersion" value="${config.kubernetes.version}">
    </div>
    <div class="form-group">
      <label>K8s Port (0 = auto)</label>
      <input type="number" id="k8sPort" value="${config.kubernetes.port}" min="0" max="65535">
    </div>
  </div>
</div>

<div class="section">
  <h2>🌐 Network</h2>
  <div class="form-grid">
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="netAddress" ${config.network.address ? 'checked' : ''}>
        <label for="netAddress">Reachable IP Address</label>
      </div>
    </div>
    <div class="form-group">
      <label>Network Mode</label>
      <select id="netMode">
        <option value="shared" ${config.network.mode === 'shared' ? 'selected' : ''}>Shared</option>
        <option value="bridged" ${config.network.mode === 'bridged' ? 'selected' : ''}>Bridged</option>
      </select>
    </div>
    <div class="form-group">
      <label>Network Interface</label>
      <input type="text" id="netInterface" value="${config.network.interface}">
    </div>
    <div class="form-group">
      <label>Gateway Address</label>
      <input type="text" id="gateway" value="${config.network.gatewayAddress}">
    </div>
  </div>
</div>

<div class="section">
  <h2>🔧 Advanced</h2>
  <div class="form-grid">
    <div class="form-group">
      <label>Hostname</label>
      <input type="text" id="hostname" value="${config.hostname ?? ''}">
    </div>
    <div class="form-group">
      <label>SSH Port (0 = auto)</label>
      <input type="number" id="sshPort" value="${config.sshPort}" min="0" max="65535">
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="autoActivate" ${config.autoActivate ? 'checked' : ''}>
        <label for="autoActivate">Auto-activate Docker/K8s context</label>
      </div>
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="forwardAgent" ${config.forwardAgent ? 'checked' : ''}>
        <label for="forwardAgent">Forward SSH agent</label>
      </div>
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="sshConfig" ${config.sshConfig ? 'checked' : ''}>
        <label for="sshConfig">Modify ~/.ssh/config</label>
      </div>
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="rosetta" ${config.rosetta ? 'checked' : ''}>
        <label for="rosetta">Enable Rosetta</label>
      </div>
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="binfmt" ${config.binfmt ? 'checked' : ''}>
        <label for="binfmt">Enable binfmt</label>
      </div>
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <input type="checkbox" id="nestedVirt" ${config.nestedVirtualization ? 'checked' : ''}>
        <label for="nestedVirt">Nested virtualization</label>
      </div>
    </div>
  </div>
</div>

<div class="actions">
  <button class="secondary" onclick="cancel()">Cancel</button>
  <button onclick="save()">Save Configuration</button>
</div>

<script>
  const vscode = acquireVsCodeApi();

  function save() {
    vscode.postMessage({
      command: 'save',
      config: {
        cpu: parseInt(document.getElementById('cpu').value),
        memory: parseInt(document.getElementById('memory').value),
        disk: parseInt(document.getElementById('disk').value),
        rootDisk: parseInt(document.getElementById('rootDisk').value),
        runtime: document.getElementById('runtime').value,
        vmType: document.getElementById('vmType').value,
        mountType: document.getElementById('mountType').value,
        arch: document.getElementById('arch').value,
        hostname: document.getElementById('hostname').value,
        sshPort: parseInt(document.getElementById('sshPort').value),
        autoActivate: document.getElementById('autoActivate').checked,
        forwardAgent: document.getElementById('forwardAgent').checked,
        sshConfig: document.getElementById('sshConfig').checked,
        rosetta: document.getElementById('rosetta').checked,
        binfmt: document.getElementById('binfmt').checked,
        nestedVirtualization: document.getElementById('nestedVirt').checked,
        k8sEnabled: document.getElementById('k8sEnabled').checked,
        k8sVersion: document.getElementById('k8sVersion').value,
        k8sPort: parseInt(document.getElementById('k8sPort').value),
        netAddress: document.getElementById('netAddress').checked,
        netMode: document.getElementById('netMode').value,
      }
    });
  }

  function cancel() {
    vscode.postMessage({ command: 'cancel' });
  }
</script>
</body>
</html>`;
  }
}
