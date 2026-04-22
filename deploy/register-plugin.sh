#!/bin/sh
# Register wechat-filehelper plugin and configure OpenClaw on startup.
set -e

CONFIG_DIR="${HOME}/.openclaw"
CONFIG_FILE="${CONFIG_DIR}/openclaw.json"
PLUGIN_PATH="/app/plugins/wechat-filehelper"

mkdir -p "$CONFIG_DIR"

# Ensure directory is writable (volume mount may reset ownership)
if [ ! -w "$CONFIG_DIR" ]; then
  echo "[register-plugin] WARNING: $CONFIG_DIR not writable, attempting fix..."
  chmod 755 "$CONFIG_DIR" 2>/dev/null || true
fi

node -e "
  const fs = require('fs');
  const configFile = '$CONFIG_FILE';
  const pluginPath = '$PLUGIN_PATH';
  const apiKey = process.env.MODELS_API_KEY || '';
  const baseUrl = process.env.MODELS_BASE_URL || '';

  // Load existing or start fresh
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch(e) {}

  // ── Plugins ──
  if (!cfg.plugins) cfg.plugins = {};
  if (!cfg.plugins.entries) cfg.plugins.entries = {};
  if (!cfg.plugins.load) cfg.plugins.load = {};
  if (!cfg.plugins.load.paths) cfg.plugins.load.paths = [];
  if (!cfg.plugins.installs) cfg.plugins.installs = {};

  cfg.plugins.entries['wechat-filehelper'] = { enabled: true };
  if (!cfg.plugins.load.paths.includes(pluginPath)) {
    cfg.plugins.load.paths.push(pluginPath);
  }
  cfg.plugins.installs['wechat-filehelper'] = {
    source: 'path', sourcePath: pluginPath, installPath: pluginPath, version: '1.0.0'
  };

  // ── Channel ──
  if (!cfg.channels) cfg.channels = {};
  if (!cfg.channels['wechat-filehelper']) {
    cfg.channels['wechat-filehelper'] = {
      enabled: true, apiUrl: 'http://localhost:23051', pollInterval: 2000, dmPolicy: 'open'
    };
  }

  // ── Gateway ──
  if (!cfg.gateway) cfg.gateway = {};
  if (!cfg.gateway.controlUi) cfg.gateway.controlUi = {};
  cfg.gateway.controlUi.allowedOrigins = ['*'];
  if (!cfg.gateway.mode) cfg.gateway.mode = 'local';

  // ── Models (apiKey & baseUrl from env, model definitions hardcoded) ──
  if (apiKey && baseUrl) {
    cfg.models = {
      mode: 'merge',
      providers: {
        wanshiwu: {
          baseUrl: baseUrl,
          apiKey: apiKey,
          api: 'anthropic-messages',
          models: [
            { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', reasoning: true, input: ['text','image'], cost: { input: 30, output: 150, cacheRead: 3, cacheWrite: 15 }, contextWindow: 200000, maxTokens: 32768 },
            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', reasoning: false, input: ['text','image'], cost: { input: 30, output: 150, cacheRead: 3, cacheWrite: 15 }, contextWindow: 200000, maxTokens: 32768 }
          ]
        },
        'wanshiwu-openai': {
          baseUrl: baseUrl + '/v1',
          apiKey: apiKey,
          api: 'openai-completions',
          models: [
            { id: 'gpt-5.4', name: 'gpt-5.4', reasoning: false, input: ['text','image'], cost: { input: 30, output: 150, cacheRead: 3, cacheWrite: 15 }, contextWindow: 256000, maxTokens: 32768 },
            { id: 'gpt-5.3-codex', name: 'gpt-5.3-codex', reasoning: false, input: ['text','image'], cost: { input: 30, output: 150, cacheRead: 3, cacheWrite: 15 }, contextWindow: 256000, maxTokens: 32768 },
            { id: 'gpt-4o', name: 'gpt-4o', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 256000, maxTokens: 8192 },
            { id: 'glm-5', name: 'glm-5', reasoning: false, input: ['text','image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 256000, maxTokens: 8192 }
          ]
        }
      }
    };
    console.log('[register-plugin] Models configured (2 providers, 6 models)');
  }

  // ── Default Agent Model ──
  if (!cfg.agents) cfg.agents = {};
  if (!cfg.agents.defaults) cfg.agents.defaults = {};
  if (!cfg.agents.defaults.model) cfg.agents.defaults.model = 'wanshiwu/claude-sonnet-4-6';

  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
  console.log('[register-plugin] Config updated successfully');
"
