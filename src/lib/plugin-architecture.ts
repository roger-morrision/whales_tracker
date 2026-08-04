/**
 * Plugin Architecture
 * Dynamic imports, sandboxed plugins, manifest v2
 */

export interface PluginManifest {
  version: 2;
  id: string;
  name: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  main: string; // Entry point
  types?: string; // TypeScript definitions
  icon?: string;
  permissions: PluginPermission[];
  dependencies: PluginDependency[];
  apiVersion: string;
  minAppVersion: string;
  maxAppVersion?: string;
  config?: PluginConfigSchema;
  hooks: PluginHook[];
  commands?: PluginCommand[];
  ui?: PluginUIExtension[];
  background?: boolean;
}

export interface PluginPermission {
  name: string;
  description: string;
  required: boolean;
  scopes?: string[];
}

export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    default?: any;
    enum?: any[];
    minimum?: number;
    maximum?: number;
  }>;
  required?: string[];
}

export interface PluginHook {
  name: string;
  description: string;
  async: boolean;
  params: Record<string, any>;
  returns?: any;
}

export interface PluginCommand {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  handler: string; // Function name in plugin
}

export interface PluginUIExtension {
  type: 'panel' | 'modal' | 'widget' | 'menu-item' | 'tab' | 'sidebar';
  id: string;
  title: string;
  component: string; // Component export name
  position?: string;
  order?: number;
  condition?: string; // When to show
}

export interface PluginContext {
  api: PluginAPI;
  config: Record<string, any>;
  store: PluginStore;
  events: PluginEventEmitter;
  logger: PluginLogger;
  storage: PluginStorage;
  i18n: PluginI18n;
}

export interface PluginAPI {
  // Portfolio
  portfolio: {
    getBalance: () => Promise<any>;
    getPositions: () => Promise<any>;
    getPnL: (timeframe?: string) => Promise<any>;
    subscribe: (callback: (data: any) => void) => () => void;
  };
  // Trading
  trading: {
    buy: (params: { token: string; amount: number; slippage?: number }) => Promise<any>;
    sell: (params: { token: string; amount: number; slippage?: number }) => Promise<any>;
    getQuote: (params: { inputMint: string; outputMint: string; amount: number }) => Promise<any>;
    createSnipeRule: (rule: any) => Promise<any>;
    createDCA: (params: any) => Promise<any>;
    setTrailingStop: (params: any) => Promise<any>;
  };
  // Market Data
  market: {
    getPrice: (token: string) => Promise<number>;
    getOrderBook: (token: string) => Promise<any>;
    getSmartMoneyFlow: (token: string) => Promise<any>;
    getSecurityScore: (token: string) => Promise<any>;
    getArbitrageOpportunities: () => Promise<any>;
    getNewLaunches: (filters?: any) => Promise<any>;
    subscribe: (callback: (data: any) => void) => () => void;
  };
  // Alerts
  alerts: {
    create: (alert: any) => Promise<any>;
    list: () => Promise<any>;
    remove: (id: string) => Promise<void>;
    onTrigger: (callback: (alert: any) => void) => () => void;
  };
  // Wallet
  wallet: {
    connect: () => Promise<any>;
    disconnect: () => Promise<void>;
    getAddress: () => string | null;
    signMessage: (message: string) => Promise<string>;
    signTransaction: (tx: any) => Promise<any>;
  };
  // AI
  ai: {
    chat: (message: string, context?: any) => Promise<any>;
    analyzePortfolio: () => Promise<any>;
    generateAlert: (params: any) => Promise<any>;
    backtestStrategy: (strategy: any) => Promise<any>;
  };
  // Workflow
  workflow: {
    create: (workflow: any) => Promise<any>;
    execute: (id: string, triggerData?: any) => Promise<any>;
    list: () => Promise<any>;
    onExecution: (callback: (execution: any) => void) => () => void;
  };
}

export interface PluginStore {
  getState: () => any;
  subscribe: (callback: (state: any) => void) => () => void;
  dispatch: (action: any) => void;
  select: <T>(selector: (state: any) => T) => T;
}

export interface PluginEventEmitter {
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => void;
  once: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
}

export interface PluginLogger {
  debug: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
}

export interface PluginStorage {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
}

export interface PluginI18n {
  t: (key: string, params?: Record<string, any>) => string;
  setLocale: (locale: string) => void;
  getLocale: () => string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  exports: any;
  context: PluginContext;
  enabled: boolean;
  loadedAt: number;
  error?: string;
}

class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginDir = '/plugins/';
  private api: PluginAPI;
  private store: PluginStore;
  private events: PluginEventEmitter;
  private logger: PluginLogger;
  private storage: PluginStorage;
  private i18n: PluginI18n;
  private subscribers: Set<(plugins: LoadedPlugin[]) => void> = new Set();
  private hookHandlers: Map<string, ((...args: any[]) => void)[]> = new Map();
  private commandRegistry: Map<string, { pluginId: string; command: PluginCommand }> = new Map();
  private uiExtensions: Map<string, PluginUIExtension[]> = new Map();

  constructor() {
    this.initializeCoreServices();
    this.api = this.createAPI();
  }

  private initializeCoreServices(): void {
    // Event emitter
    this.events = {
      on: (event, callback) => {
        if (!this.hookHandlers.has(event)) this.hookHandlers.set(event, []);
        this.hookHandlers.get(event)!.push(callback);
        return () => this.events.off(event, callback);
      },
      emit: (event, ...args) => {
        const handlers = this.hookHandlers.get(event) || [];
        for (const handler of handlers) {
          try { handler(...args); } catch (e) { console.error(`[Plugin] Hook ${event} error:`, e); }
        }
      },
      once: (event, callback) => {
        const wrapper = (...args: any[]) => {
          callback(...args);
          this.events.off(event, wrapper);
        };
        this.events.on(event, wrapper);
      },
      off: (event, callback) => {
        const handlers = this.hookHandlers.get(event) || [];
        const index = handlers.indexOf(callback);
        if (index !== -1) handlers.splice(index, 1);
      },
    };

    // Logger
    this.logger = {
      debug: (msg, meta) => console.debug(`[Plugin] ${msg}`, meta),
      info: (msg, meta) => console.info(`[Plugin] ${msg}`, meta),
      warn: (msg, meta) => console.warn(`[Plugin] ${msg}`, meta),
      error: (msg, meta) => console.error(`[Plugin] ${msg}`, meta),
    };

    // Storage (IndexedDB wrapper)
    this.storage = {
      get: async (key) => {
        // In production, use IndexedDB
        return localStorage.getItem(`plugin:${key}`) ? JSON.parse(localStorage.getItem(`plugin:${key}`)!) : null;
      },
      set: async (key, value) => {
        localStorage.setItem(`plugin:${key}`, JSON.stringify(value));
      },
      delete: async (key) => {
        localStorage.removeItem(`plugin:${key}`);
      },
      clear: async () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('plugin:'));
        keys.forEach(k => localStorage.removeItem(k));
      },
      keys: async () => {
        return Object.keys(localStorage).filter(k => k.startsWith('plugin:')).map(k => k.replace('plugin:', ''));
      },
    };

    // I18n
    this.i18n = {
      t: (key, params) => {
        // Simple template replacement
        let msg = key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
        }
        return msg;
      },
      setLocale: (locale) => localStorage.setItem('plugin:locale', locale),
      getLocale: () => localStorage.getItem('plugin:locale') || 'en',
    };
  }

  private createAPI(): PluginAPI {
    // This would integrate with actual app services
    return {
      portfolio: {
        getBalance: async () => ({ total: 12450, change24h: 2.3 }),
        getPositions: async () => [],
        getPnL: async (timeframe = '7d') => ({ total: 1234, percent: 11 }),
        subscribe: (cb) => { cb({}); return () => {}; },
      },
      trading: {
        buy: async (params) => ({ success: true, txId: 'mock' }),
        sell: async (params) => ({ success: true, txId: 'mock' }),
        getQuote: async (params) => ({ price: 100, impact: 0.1 }),
        createSnipeRule: async (rule) => ({ id: 'rule_1', ...rule }),
        createDCA: async (params) => ({ id: 'dca_1', ...params }),
        setTrailingStop: async (params) => ({ success: true }),
      },
      market: {
        getPrice: async (token) => 100,
        getOrderBook: async (token) => ({ bids: [], asks: [] }),
        getSmartMoneyFlow: async (token) => ({ netFlow: 0 }),
        getSecurityScore: async (token) => ({ score: 85 }),
        getArbitrageOpportunities: async () => [],
        getNewLaunches: async (filters) => [],
        subscribe: (cb) => { cb({}); return () => {}; },
      },
      alerts: {
        create: async (alert) => ({ id: 'alert_1', ...alert }),
        list: async () => [],
        remove: async (id) => {},
        onTrigger: (cb) => { cb({}); return () => {}; },
      },
      wallet: {
        connect: async () => ({ address: 'mock_address' }),
        disconnect: async () => {},
        getAddress: () => 'mock_address',
        signMessage: async (msg) => 'signed_' + msg,
        signTransaction: async (tx) => ({ ...tx, signed: true }),
      },
      ai: {
        chat: async (msg) => ({ response: 'AI response' }),
        analyzePortfolio: async () => ({ suggestions: [] }),
        generateAlert: async (params) => ({ alert: params }),
        backtestStrategy: async (strategy) => ({ results: {} }),
      },
      workflow: {
        create: async (wf) => ({ id: 'wf_1', ...wf }),
        execute: async (id) => ({ success: true }),
        list: async () => [],
        onExecution: (cb) => { cb({}); return () => {}; },
      },
    };
  }

  // Load plugin from URL
  async loadPlugin(url: string): Promise<LoadedPlugin> {
    try {
      this.logger.info(`Loading plugin from ${url}`);

      // Fetch manifest
      const manifestResponse = await fetch(`${url}/manifest.json`);
      if (!manifestResponse.ok) throw new Error('Manifest not found');
      const manifest: PluginManifest = await manifestResponse.json();

      // Validate manifest
      this.validateManifest(manifest);

      // Check compatibility
      if (!this.checkCompatibility(manifest)) {
        throw new Error(`Plugin incompatible: requires API ${manifest.apiVersion}, app version ${manifest.minAppVersion}-${manifest.maxAppVersion || 'latest'}`);
      }

      // Load plugin module
      const pluginModule = await import(`${url}/${manifest.main}`);
      const exports = pluginModule.default || pluginModule;

      // Create plugin context
      const context = this.createContext(manifest);

      // Initialize plugin
      if (exports.initialize) {
        await exports.initialize(context);
      }

      // Register hooks
      if (manifest.hooks) {
        for (const hook of manifest.hooks) {
          const handler = exports[hook.name];
          if (handler) {
            this.events.on(hook.name, handler.bind(exports, context));
          }
        }
      }

      // Register commands
      if (manifest.commands) {
        for (const command of manifest.commands) {
          this.commandRegistry.set(command.name, {
            pluginId: manifest.id,
            command,
          });
        }
      }

      // Register UI extensions
      if (manifest.ui) {
        this.uiExtensions.set(manifest.id, manifest.ui);
      }

      const loadedPlugin: LoadedPlugin = {
        manifest,
        exports,
        context,
        enabled: true,
        loadedAt: Date.now(),
      };

      this.plugins.set(manifest.id, loadedPlugin);
      this.notifySubscribers();

      this.logger.info(`Plugin loaded: ${manifest.name} (${manifest.id})`);
      return loadedPlugin;
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${url}:`, error);
      throw error;
    }
  }

  // Load plugin from manifest object (for installed plugins)
  async loadPluginFromManifest(manifest: PluginManifest, exports: any): Promise<LoadedPlugin> {
    this.validateManifest(manifest);
    
    if (!this.checkCompatibility(manifest)) {
      throw new Error(`Plugin incompatible`);
    }

    const context = this.createContext(manifest);

    if (exports.initialize) {
      await exports.initialize(context);
    }

    if (manifest.hooks) {
      for (const hook of manifest.hooks) {
        const handler = exports[hook.name];
        if (handler) {
          this.events.on(hook.name, handler.bind(exports, context));
        }
      }
    }

    if (manifest.commands) {
      for (const command of manifest.commands) {
        this.commandRegistry.set(command.name, { pluginId: manifest.id, command });
      }
    }

    if (manifest.ui) {
      this.uiExtensions.set(manifest.id, manifest.ui);
    }

    const loadedPlugin: LoadedPlugin = {
      manifest,
      exports,
      context,
      enabled: true,
      loadedAt: Date.now(),
    };

    this.plugins.set(manifest.id, loadedPlugin);
    this.notifySubscribers();

    return loadedPlugin;
  }

  private validateManifest(manifest: PluginManifest): void {
    if (manifest.version !== 2) {
      throw new Error('Only manifest v2 supported');
    }
    if (!manifest.id || !manifest.name || !manifest.main) {
      throw new Error('Missing required fields: id, name, main');
    }
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} already loaded`);
    }
  }

  private checkCompatibility(manifest: PluginManifest): boolean {
    // Check API version
    const currentApiVersion = '1.0.0';
    if (manifest.apiVersion !== currentApiVersion) {
      this.logger.warn(`Plugin ${manifest.id} uses API v${manifest.apiVersion}, current is v${currentApiVersion}`);
    }
    return true; // Simplified
  }

  private createContext(manifest: PluginManifest): PluginContext {
    // Create scoped API (only permitted methods)
    const scopedApi = this.createScopedAPI(manifest.permissions);
    
    return {
      api: scopedApi,
      config: manifest.config || {},
      store: this.createScopedStore(),
      events: this.events,
      logger: this.createScopedLogger(manifest.id),
      storage: this.createScopedStorage(manifest.id),
      i18n: this.i18n,
    };
  }

  private createScopedAPI(permissions: PluginPermission[]): PluginAPI {
    // Filter API based on permissions
    const allowedPermissions = new Set(permissions.filter(p => p.required).map(p => p.name));
    
    // In production, create proxy that checks permissions
    return this.api; // Simplified - full API for now
  }

  private createScopedStore(): PluginStore {
    // Return scoped store
    return {
      getState: () => ({}),
      subscribe: (cb) => { cb({}); return () => {}; },
      dispatch: () => {},
      select: (selector) => selector({}),
    };
  }

  private createScopedLogger(pluginId: string): PluginLogger {
    const prefix = `[Plugin:${pluginId}]`;
    return {
      debug: (msg, meta) => console.debug(`${prefix} ${msg}`, meta),
      info: (msg, meta) => console.info(`${prefix} ${msg}`, meta),
      warn: (msg, meta) => console.warn(`${prefix} ${msg}`, meta),
      error: (msg, meta) => console.error(`${prefix} ${msg}`, meta),
    };
  }

  private createScopedStorage(pluginId: string): PluginStorage {
    const prefix = `plugin:${pluginId}:`;
    return {
      get: async (key) => this.storage.get(prefix + key),
      set: async (key, value) => this.storage.set(prefix + key, value),
      delete: async (key) => this.storage.delete(prefix + key),
      clear: async () => {
        const keys = await this.storage.keys();
        for (const key of keys.filter(k => k.startsWith(prefix))) {
          await this.storage.delete(key);
        }
      },
      keys: async () => {
        const keys = await this.storage.keys();
        return keys.filter(k => k.startsWith(prefix)).map(k => k.replace(prefix, ''));
      },
    };
  }

  // Plugin management
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Call cleanup
    if (plugin.exports.cleanup) {
      try { await plugin.exports.cleanup(plugin.context); } catch (e) { this.logger.error(`Cleanup failed for ${pluginId}:`, e); }
    }

    // Remove hooks
    if (plugin.manifest.hooks) {
      for (const hook of plugin.manifest.hooks) {
        const handler = plugin.exports[hook.name];
        if (handler) {
          this.events.off(hook.name, handler.bind(plugin.exports, plugin.context));
        }
      }
    }

    // Remove commands
    if (plugin.manifest.commands) {
      for (const command of plugin.manifest.commands) {
        this.commandRegistry.delete(command.name);
      }
    }

    // Remove UI extensions
    this.uiExtensions.delete(pluginId);

    this.plugins.delete(pluginId);
    this.notifySubscribers();

    return true;
  }

  enablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = true;
    this.notifySubscribers();
    return true;
  }

  disablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = false;
    this.notifySubscribers();
    return true;
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  // Execute plugin command
  async executeCommand(commandName: string, args: string[]): Promise<any> {
    const registered = this.commandRegistry.get(commandName);
    if (!registered) throw new Error(`Command not found: ${commandName}`);

    const plugin = this.plugins.get(registered.pluginId);
    if (!plugin || !plugin.enabled) throw new Error(`Plugin not enabled: ${registered.pluginId}`);

    const handler = plugin.exports[registered.command.handler];
    if (!handler) throw new Error(`Handler not found: ${registered.command.handler}`);

    return handler(plugin.context, args);
  }

  // Get UI extensions
  getUIExtensions(): PluginUIExtension[] {
    const extensions: PluginUIExtension[] = [];
    for (const [, exts] of this.uiExtensions) {
      extensions.push(...exts);
    }
    return extensions.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // Hook execution
  async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    const results: any[] = [];
    const handlers = this.hookHandlers.get(hookName) || [];
    
    for (const handler of handlers) {
      try {
        const result = await handler(...args);
        results.push(result);
      } catch (e) {
        this.logger.error(`Hook ${hookName} error:`, e);
        results.push({ error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }
    
    return results;
  }

  // Install plugin from registry
  async installFromRegistry(pluginId: string, registryUrl: string = 'https://registry.whales-tracker.com'): Promise<LoadedPlugin> {
    const pluginUrl = `${registryUrl}/${pluginId}/latest`;
    return this.loadPlugin(pluginUrl);
  }

  // Subscriptions
  onPluginsChange(callback: (plugins: LoadedPlugin[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const plugins = this.getAllPlugins();
    for (const sub of this.subscribers) {
      try { sub(plugins); } catch (e) { console.error('[Plugin] Subscriber error:', e); }
    }
  }

  // Development: hot reload
  async hotReload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    
    // Unload and reload
    await this.unloadPlugin(pluginId);
    // Would need to reload from source
  }
}

// Singleton
let pluginManagerInstance: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new PluginManager();
  }
  return pluginManagerInstance;
}

// React hook
export function usePluginManager() {
  const manager = getPluginManager();
  
  return {
    loadPlugin: (url: string) => manager.loadPlugin(url),
    loadFromManifest: (manifest: PluginManifest, exports: any) => manager.loadPluginFromManifest(manifest, exports),
    unloadPlugin: (id: string) => manager.unloadPlugin(id),
    enablePlugin: (id: string) => manager.enablePlugin(id),
    disablePlugin: (id: string) => manager.disablePlugin(id),
    getPlugin: (id: string) => manager.getPlugin(id),
    getAllPlugins: () => manager.getAllPlugins(),
    getEnabledPlugins: () => manager.getEnabledPlugins(),
    executeCommand: (name: string, args: string[]) => manager.executeCommand(name, args),
    getUIExtensions: () => manager.getUIExtensions(),
    executeHook: (name: string, ...args: any[]) => manager.executeHook(name, ...args),
    installFromRegistry: (id: string, registryUrl?: string) => manager.installFromRegistry(id, registryUrl),
    onPluginsChange: (callback: (plugins: LoadedPlugin[]) => void) => manager.onPluginsChange(callback),
  };
}

export type { PluginManifest, PluginPermission, PluginDependency, PluginConfigSchema, PluginHook, PluginCommand, PluginUIExtension, PluginContext, PluginAPI, PluginStore, PluginEventEmitter, PluginLogger, PluginStorage, PluginI18n, LoadedPlugin };