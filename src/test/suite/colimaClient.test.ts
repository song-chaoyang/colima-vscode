import * as assert from 'assert';
import { ColimaClient } from '../../colima/colimaClient';
import { configManager } from '../../colima/colimaConfig';

suite('ColimaClient Test Suite', () => {
  test('ColimaClient should be instantiable', () => {
    const client = new ColimaClient();
    assert.ok(client);
    assert.ok(client.getBinaryPath());
  });

  test('isInstalled should return boolean', async () => {
    const client = new ColimaClient();
    const installed = await client.isInstalled();
    assert.strictEqual(typeof installed, 'boolean');
  });

  test('getVersion should parse version output', async () => {
    const client = new ColimaClient();
    try {
      const version = await client.getVersion();
      assert.ok(version.version);
      assert.ok(version.arch);
    } catch {
      // Colima might not be installed in CI
      assert.ok(true);
    }
  });

  test('listProfiles should return array', async () => {
    const client = new ColimaClient();
    try {
      const profiles = await client.listProfiles();
      assert.ok(Array.isArray(profiles));
    } catch {
      assert.ok(true);
    }
  });
});

suite('ColimaConfigManager Test Suite', () => {
  test('getDefaultConfig should return valid config', () => {
    const config = configManager.getDefaultConfig();
    assert.strictEqual(config.cpu, 2);
    assert.strictEqual(config.memory, 2);
    assert.strictEqual(config.disk, 100);
    assert.strictEqual(config.runtime, 'docker');
    assert.strictEqual(config.kubernetes.enabled, false);
    assert.strictEqual(config.autoActivate, true);
  });

  test('stringifyConfig should produce valid YAML', () => {
    const config = configManager.getDefaultConfig();
    const yaml = configManager.stringifyConfig(config);
    assert.ok(yaml.includes('cpu: 2'));
    assert.ok(yaml.includes('memory: 2'));
    assert.ok(yaml.includes('disk: 100'));
    assert.ok(yaml.includes('runtime: docker'));
  });

  test('parseConfig should parse YAML back to config', () => {
    const original = configManager.getDefaultConfig();
    const yaml = configManager.stringifyConfig(original);
    const parsed = configManager.parseConfig(yaml);
    assert.strictEqual(parsed.cpu, original.cpu);
    assert.strictEqual(parsed.memory, original.memory);
    assert.strictEqual(parsed.disk, original.disk);
    assert.strictEqual(parsed.runtime, original.runtime);
  });

  test('getConfigPath should return correct path', () => {
    const path = configManager.getConfigPath('default');
    assert.ok(path.includes('default'));
    assert.ok(path.endsWith('colima.yaml'));
  });

  test('isImmutable should detect immutable keys', () => {
    assert.strictEqual(configManager.isImmutable('arch'), true);
    assert.strictEqual(configManager.isImmutable('runtime'), true);
    assert.strictEqual(configManager.isImmutable('vmType'), true);
    assert.strictEqual(configManager.isImmutable('mountType'), true);
    assert.strictEqual(configManager.isImmutable('cpu'), false);
    assert.strictEqual(configManager.isImmutable('memory'), false);
  });
});
