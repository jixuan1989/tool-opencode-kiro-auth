import { KIRO_CONSTANTS } from './constants.js';
import { AuthHandler } from './core/auth/auth-handler.js';
import { RequestHandler } from './core/request/request-handler.js';
import { AccountCache } from './infrastructure/database/account-cache.js';
import { AccountRepository } from './infrastructure/database/account-repository.js';
import { AccountManager } from './plugin/accounts.js';
import { loadConfig } from './plugin/config/index.js';
const _origPrepareStackTrace = Error.prepareStackTrace;
Error.prepareStackTrace = (error, structuredStack) => {
    if (error.name === 'ProviderInitError') {
        const cause = error.cause;
        const data = error.data;
        console.error('[kiro-auth] ===== ProviderInitError INTERCEPTED =====');
        console.error('[kiro-auth]   providerID:', data?.providerID ?? 'unknown');
        console.error('[kiro-auth]   cause type:', typeof cause, cause?.constructor?.name ?? 'n/a');
        console.error('[kiro-auth]   cause message:', cause?.message ?? String(cause));
        console.error('[kiro-auth]   cause stack:', cause?.stack ?? 'no stack');
        if (cause?.cause) {
            console.error('[kiro-auth]   nested cause:', cause.cause?.message ?? cause.cause);
        }
        console.error('[kiro-auth] ========================================');
    }
    if (_origPrepareStackTrace) {
        Error.prepareStackTrace = _origPrepareStackTrace;
        const result = _origPrepareStackTrace(error, structuredStack);
        Error.prepareStackTrace = _patchedPrepareStackTrace;
        return result;
    }
    return error.toString();
};
const _patchedPrepareStackTrace = Error.prepareStackTrace;
const KIRO_PROVIDER_ID = 'kiro';
export const createKiroPlugin = (id) => async ({ client, directory }) => {
    const config = loadConfig(directory);
    const showToast = (message, variant) => {
        client.tui.showToast({ body: { message, variant } }).catch(() => { });
    };
    const cache = new AccountCache(60000);
    const repository = new AccountRepository(cache);
    const authHandler = new AuthHandler(config, repository);
    const accountManager = await AccountManager.loadFromDisk(config.account_selection_strategy);
    authHandler.setAccountManager(accountManager);
    const requestHandler = new RequestHandler(accountManager, config, repository);
    return {
        auth: {
            provider: id,
            loader: async (getAuth) => {
                try {
                    console.error('[kiro-auth] loader: starting...');
                    await getAuth();
                    console.error('[kiro-auth] loader: getAuth() done');
                    await authHandler.initialize();
                    console.error('[kiro-auth] loader: authHandler.initialize() done');
                    const result = {
                        apiKey: '',
                        baseURL: KIRO_CONSTANTS.BASE_URL.replace('/generateAssistantResponse', '').replace('{{region}}', config.default_region || 'us-east-1'),
                        fetch: (input, init) => requestHandler.handle(input, init, showToast)
                    };
                    console.error('[kiro-auth] loader: returning options keys:', Object.keys(result));
                    console.error('[kiro-auth] loader: apiKey=' + JSON.stringify(result.apiKey) + ' baseURL=' + result.baseURL + ' fetch=' + typeof result.fetch);
                    return result;
                }
                catch (err) {
                    console.error('[kiro-auth] loader ERROR:', err?.message ?? err);
                    console.error('[kiro-auth] loader stack:', err?.stack ?? 'no stack');
                    throw err;
                }
            },
            methods: authHandler.getMethods()
        }
    };
};
export const KiroOAuthPlugin = createKiroPlugin(KIRO_PROVIDER_ID);
/** New-style PluginModule export for OpenCode ≥ 1.14 */
const pluginModule = {
    id: 'kiro-auth',
    server: KiroOAuthPlugin
};
export default pluginModule;
