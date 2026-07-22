import * as vscode from 'vscode';
import type { ColimaClient } from '../colima/colimaClient';
import type { StartOptions } from '../types';
import { t, getLocale } from '../i18n';
import { startWithOptions } from '../commands/startCommand';

export class StartWizard {
  private panel: vscode.WebviewPanel | undefined;
  private client: ColimaClient;
  private refreshCallback: () => void;

  constructor(client: ColimaClient, refreshCallback: () => void) {
    this.client = client;
    this.refreshCallback = refreshCallback;
  }

  show(profileName?: string): void {
    if (this.panel) { this.panel.reveal(vscode.ViewColumn.Active); return; }

    this.panel = vscode.window.createWebviewPanel(
      'colimaStartWizard', 'Colima: ' + t('wizard.title'),
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] },
    );

    this.panel.webview.html = this.getHtml(profileName);

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'startWithPreset': {
          const options = this.presetToOptions(message.preset, message.profile);
          await startWithOptions(this.client, options, this.refreshCallback);
          this.panel?.dispose();
          break;
        }
        case 'startCustom': {
          const options = this.formToOptions(message.config, message.profile);
          await startWithOptions(this.client, options, this.refreshCallback);
          this.panel?.dispose();
          break;
        }
        case 'close': { this.panel?.dispose(); break; }
      }
    }, undefined, []);

    this.panel.onDidDispose(() => { this.panel = undefined; });
  }

  private presetToOptions(preset: string, profile?: string): StartOptions {
    const presets: Record<string, StartOptions> = {
      quick: { profile, cpu: 2, memory: 2, disk: 100, runtime: 'auto' as any },
      dev: { profile, cpu: 4, memory: 8, disk: 100, runtime: 'auto' as any },
      k8s: { profile, cpu: 4, memory: 8, disk: 100, runtime: 'auto' as any, kubernetes: true },
      containerd: { profile, cpu: 2, memory: 2, disk: 100, runtime: 'containerd' },
      ai: { profile, cpu: 4, memory: 8, disk: 100, runtime: 'auto' as any, vmType: 'auto' as any },
    };
    return presets[preset] ?? presets.quick;
  }

  private formToOptions(config: any, profile?: string): StartOptions {
    const options: StartOptions = { profile };
    if (config.cpu) options.cpu = config.cpu;
    if (config.memory) options.memory = config.memory;
    if (config.disk) options.disk = config.disk;
    if (config.runtime) options.runtime = config.runtime;
    if (config.vmType) options.vmType = config.vmType;
    if (config.arch) options.arch = config.arch;
    // Always set kubernetes explicitly — false overrides any existing config with k8s enabled
    options.kubernetes = config.kubernetes === true;
    if (config.kubernetesVersion) options.kubernetesVersion = config.kubernetesVersion;
    if (config.mountType) options.mountType = config.mountType;
    if (config.networkAddress) options.networkAddress = config.networkAddress;
    if (config.dns && config.dns.length > 0) options.dns = config.dns;
    if (config.env && Object.keys(config.env).length > 0) options.env = config.env;
    if (config.sshAgent) options.sshAgent = config.sshAgent;
    if (config.hostname) options.hostname = config.hostname;
    return options;
  }

  private getHtml(profileName?: string): string {
    const initialProfile = profileName || 'default';
    const zh = getLocale() === 'zh';
    return `<!DOCTYPE html>
<html lang="${zh ? 'zh' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t('wizard.title')}</title>
<style>
  body{font-family:var(--vscode-font-family,-apple-system,sans-serif);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;max-width:900px;margin:0 auto}
  h1{font-size:1.6em;margin-bottom:4px}
  .subtitle{color:var(--vscode-descriptionForeground);margin-bottom:24px}
  .profile-row{display:flex;gap:12px;align-items:center;margin-bottom:24px}
  .profile-row label{font-weight:600;white-space:nowrap}
  input[type="text"]{flex:1;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,transparent);color:var(--vscode-input-foreground);padding:6px 10px;border-radius:4px;font-size:13px}
  .presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:32px}
  .preset-card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-editorWidget-border);border-radius:8px;padding:16px;cursor:pointer;transition:all .2s}
  .preset-card:hover{border-color:var(--vscode-focusBorder);background:var(--vscode-list-hoverBackground)}
  .preset-card .icon{font-size:2em;margin-bottom:8px}
  .preset-card h3{margin:0 0 4px;font-size:1.1em}
  .preset-card .desc{color:var(--vscode-descriptionForeground);font-size:12px;margin-bottom:8px}
  .preset-card .specs{font-size:11px;color:var(--vscode-descriptionForeground)}
  .preset-card .specs span{margin-right:8px}
  .custom-section{border:1px solid var(--vscode-editorWidget-border);border-radius:8px;overflow:hidden}
  .custom-header{padding:12px 16px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px;user-select:none}
  .custom-header:hover{background:var(--vscode-list-hoverBackground)}
  .custom-body{padding:16px;display:none}
  .custom-body.open{display:block}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .form-group{margin-bottom:12px}
  .form-group label{display:block;font-size:12px;margin-bottom:4px;color:var(--vscode-descriptionForeground)}
  .form-group input,.form-group select{width:100%;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,transparent);color:var(--vscode-input-foreground);padding:6px 10px;border-radius:4px;font-size:13px;box-sizing:border-box}
  .form-group input[type="range"]{padding:0}
  .range-value{font-weight:600;color:var(--vscode-textLink-foreground)}
  .toggle-row{display:flex;align-items:center;gap:8px}
  .toggle-row input[type="checkbox"]{width:16px;height:16px;accent-color:var(--vscode-button-background)}
  .env-row{display:flex;gap:8px;margin-bottom:4px}
  .env-row input{flex:1}
  .btn-remove{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-input-border,transparent);color:var(--vscode-foreground);border-radius:4px;padding:4px 8px;cursor:pointer}
  .actions{display:flex;gap:12px;margin-top:24px;justify-content:flex-end}
  button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 24px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600}
  button:hover{background:var(--vscode-button-hoverBackground)}
  button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
  .advanced{margin-top:16px}
  .advanced summary{cursor:pointer;color:var(--vscode-descriptionForeground);font-size:12px}
</style>
</head>
<body>
<h1>${t('wizard.title')}</h1>
<p class="subtitle">${t('wizard.subtitle')}</p>

<div class="profile-row">
  <label>${t('label.profileName')}:</label>
  <input type="text" id="profileName" value="${initialProfile}" placeholder="default">
</div>

<h2>${t('wizard.quickPresets')}</h2>
<div class="presets" id="presets">
  <div class="preset-card" onclick="startPreset('quick')">
    <div class="icon">🚀</div><h3>${t('preset.quick')}</h3>
    <p class="desc">${t('preset.quick.desc')}</p>
    <div class="specs"><span>2 CPU</span><span>2G RAM</span><span>100G Disk</span><span>Docker</span></div>
  </div>
  <div class="preset-card" onclick="startPreset('dev')">
    <div class="icon">💻</div><h3>${t('preset.dev')}</h3>
    <p class="desc">${t('preset.dev.desc')}</p>
    <div class="specs"><span>4 CPU</span><span>8G RAM</span><span>100G Disk</span><span>Docker</span></div>
  </div>
  <div class="preset-card" onclick="startPreset('k8s')">
    <div class="icon">☸️</div><h3>${t('preset.k8s')}</h3>
    <p class="desc">${t('preset.k8s.desc')}</p>
    <div class="specs"><span>4 CPU</span><span>8G RAM</span><span>K3s</span><span>Docker</span></div>
  </div>
  <div class="preset-card" onclick="startPreset('containerd')">
    <div class="icon">📦</div><h3>${t('preset.containerd')}</h3>
    <p class="desc">${t('preset.containerd.desc')}</p>
    <div class="specs"><span>2 CPU</span><span>2G RAM</span><span>Containerd</span></div>
  </div>
  <div class="preset-card" onclick="startPreset('ai')">
    <div class="icon">🤖</div><h3>${t('preset.ai')}</h3>
    <p class="desc">${t('preset.ai.desc')}</p>
    <div class="specs"><span>4 CPU</span><span>8G RAM</span><span>VZ</span><span>Docker</span></div>
  </div>
</div>

<div class="custom-section">
  <div class="custom-header" onclick="toggleCustom()">
    <span>⚙️ ${t('wizard.customConfig')}</span>
    <span style="margin-left:auto">▼</span>
  </div>
  <div class="custom-body" id="customBody">
    <div class="form-grid">
      <div class="form-group">
        <label>${t('label.cpu')}: <span class="range-value" id="cpuVal">2</span></label>
        <input type="range" id="cpu" min="1" max="16" value="2" oninput="document.getElementById('cpuVal').textContent=this.value">
      </div>
      <div class="form-group">
        <label>${t('label.memory')}: <span class="range-value" id="memVal">2</span></label>
        <input type="range" id="memory" min="1" max="64" value="2" oninput="document.getElementById('memVal').textContent=this.value">
      </div>
      <div class="form-group">
        <label>${t('label.disk')}</label>
        <input type="number" id="disk" value="100" min="10" max="1000">
      </div>
      <div class="form-group">
        <label>${t('label.runtime')}</label>
        <select id="runtime"><option value="docker">Docker</option><option value="containerd">Containerd</option><option value="incus">Incus</option></select>
      </div>
      <div class="form-group">
        <label>${t('label.vmType')}</label>
        <select id="vmType"><option value="vz">VZ (Apple Virtualization)</option><option value="qemu">QEMU</option><option value="krunkit">Krunkit (GPU)</option></select>
      </div>
      <div class="form-group">
        <label>${t('label.mountType')}</label>
        <select id="mountType"><option value="virtiofs">VirtioFS</option><option value="9p">9p</option><option value="sshfs">SSHFS</option></select>
      </div>
    </div>
    <div class="form-group"><div class="toggle-row"><input type="checkbox" id="kubernetes"><label for="kubernetes">${t('label.kubernetes')}</label></div></div>
    <div class="form-group" id="k8sVersionGroup" style="display:none"><label>${t('label.k8sVersion')}</label><input type="text" id="kubernetesVersion" value="v1.35.0+k3s1"></div>
    <div class="form-group"><div class="toggle-row"><input type="checkbox" id="networkAddress"><label for="networkAddress">${t('label.networkAddress')}</label></div></div>
    <div class="form-group"><div class="toggle-row"><input type="checkbox" id="sshAgent"><label for="sshAgent">${t('label.sshAgent')}</label></div></div>
    <details class="advanced">
      <summary>${t('label.advanced')}</summary>
      <div class="form-grid" style="margin-top:12px">
        <div class="form-group"><label>${t('label.arch')}</label><select id="arch"><option value="host">Host (auto)</option><option value="aarch64">ARM64</option><option value="x86_64">x86_64</option></select></div>
        <div class="form-group"><label>${t('label.hostname')}</label><input type="text" id="hostname" placeholder="colima"></div>
        <div class="form-group"><label>${t('label.rootDisk')}</label><input type="number" id="rootDisk" value="20" min="5" max="500"></div>
        <div class="form-group"><label>${t('label.dns')}</label><input type="text" id="dns" placeholder="8.8.8.8, 1.1.1.1"></div>
      </div>
      <div id="envEditor"><label>${t('label.envVars')}</label><div id="envRows"></div><button class="btn-remove" onclick="addEnvRow()" style="margin-top:4px">+ Add</button></div>
    </details>
    <div class="actions">
      <button class="secondary" onclick="closePanel()">${t('wizard.cancel')}</button>
      <button onclick="startCustom()">${t('wizard.startColima')}</button>
    </div>
  </div>
</div>

<script>
  const vscode=acquireVsCodeApi();
  function toggleCustom(){document.getElementById('customBody').classList.toggle('open')}
  document.getElementById('kubernetes').addEventListener('change',function(){document.getElementById('k8sVersionGroup').style.display=this.checked?'block':'none'});
  function startPreset(preset){vscode.postMessage({command:'startWithPreset',preset,profile:document.getElementById('profileName').value||'default'})}
  function startCustom(){
    const profile=document.getElementById('profileName').value||'default';
    const dnsStr=document.getElementById('dns').value.trim();
    const dns=dnsStr?dnsStr.split(',').map(s=>s.trim()).filter(Boolean):[];
    const env={};document.querySelectorAll('.env-row').forEach(row=>{const key=row.querySelector('.env-key').value.trim();const val=row.querySelector('.env-val').value.trim();if(key)env[key]=val});
    vscode.postMessage({command:'startCustom',profile,config:{
      cpu:parseInt(document.getElementById('cpu').value),memory:parseInt(document.getElementById('memory').value),
      disk:parseInt(document.getElementById('disk').value),runtime:document.getElementById('runtime').value,
      vmType:document.getElementById('vmType').value,mountType:document.getElementById('mountType').value,
      kubernetes:document.getElementById('kubernetes').checked,
      kubernetesVersion:document.getElementById('kubernetes').checked?document.getElementById('kubernetesVersion').value:undefined,
      arch:document.getElementById('arch').value!=='host'?document.getElementById('arch').value:undefined,
      networkAddress:document.getElementById('networkAddress').checked,sshAgent:document.getElementById('sshAgent').checked,
      hostname:document.getElementById('hostname').value||undefined,rootDisk:parseInt(document.getElementById('rootDisk').value),dns,env
    }})
  }
  function addEnvRow(key='',val=''){
    const row=document.createElement('div');row.className='env-row';
    row.innerHTML='<input type="text" class="env-key" placeholder="KEY" value="'+key+'"><input type="text" class="env-val" placeholder="value" value="'+val+'"><button class="btn-remove" onclick="this.parentElement.remove()">✕</button>';
    document.getElementById('envRows').appendChild(row)
  }
  function closePanel(){vscode.postMessage({command:'close'})}
</script>
</body></html>`;
  }
}
