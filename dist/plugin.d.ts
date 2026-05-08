import type { Plugin, PluginModule } from '@opencode-ai/plugin';
export declare const createKiroPlugin: (id: string) => Plugin;
export declare const KiroOAuthPlugin: Plugin;
/** New-style PluginModule export for OpenCode ≥ 1.14 */
declare const pluginModule: PluginModule;
export default pluginModule;
