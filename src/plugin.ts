import type { Plugin, PluginModule } from '@opencode-ai/plugin'
import { KIRO_CONSTANTS } from './constants'
import { AuthHandler } from './core/auth/auth-handler'
import { RequestHandler } from './core/request/request-handler'
import { AccountCache } from './infrastructure/database/account-cache'
import { AccountRepository } from './infrastructure/database/account-repository'
import { AccountManager } from './plugin/accounts'
import { loadConfig } from './plugin/config/index'
import { debug, error as logError } from './plugin/logger'

const _origPrepareStackTrace = Error.prepareStackTrace
Error.prepareStackTrace = (error: Error, structuredStack: any) => {
  if ((error as any).name === 'ProviderInitError') {
    const cause = (error as any).cause
    const data = (error as any).data
    logError('ProviderInitError INTERCEPTED', {
      providerID: data?.providerID ?? 'unknown',
      causeType: typeof cause,
      causeConstructor: cause?.constructor?.name ?? 'n/a',
      causeMessage: cause?.message ?? String(cause),
      causeStack: cause?.stack ?? 'no stack',
      nestedCause: cause?.cause?.message ?? cause?.cause ?? null
    })
  }
  if (_origPrepareStackTrace) {
    Error.prepareStackTrace = _origPrepareStackTrace
    const result = _origPrepareStackTrace(error, structuredStack)
    Error.prepareStackTrace = _patchedPrepareStackTrace
    return result
  }
  return error.toString()
}
const _patchedPrepareStackTrace = Error.prepareStackTrace as typeof _origPrepareStackTrace

type ToastVariant = 'success' | 'info' | 'warning' | 'error'
type ToastFunction = (message: string, variant: ToastVariant) => void

const KIRO_PROVIDER_ID = 'kiro'

export const createKiroPlugin =
  (id: string): Plugin =>
  async ({ client, directory }) => {
    const config = loadConfig(directory)

    const showToast: ToastFunction = (message: string, variant: ToastVariant) => {
      client.tui.showToast({ body: { message, variant } }).catch(() => {})
    }

    const cache = new AccountCache(60000)
    const repository = new AccountRepository(cache)

    const authHandler = new AuthHandler(config, repository)
    const accountManager = await AccountManager.loadFromDisk(config.account_selection_strategy)
    authHandler.setAccountManager(accountManager)

    const requestHandler = new RequestHandler(accountManager, config, repository)

    return {
      auth: {
        provider: id,
        loader: async (getAuth: any) => {
          try {
            debug('loader: starting...')
            await getAuth()
            debug('loader: getAuth() done')
            await authHandler.initialize()
            debug('loader: authHandler.initialize() done')

            const result = {
              apiKey: '',
              baseURL: KIRO_CONSTANTS.BASE_URL.replace('/generateAssistantResponse', '').replace(
                '{{region}}',
                config.default_region || 'us-east-1'
              ),
              fetch: (input: any, init?: any) => requestHandler.handle(input, init, showToast)
            }
            debug(
              'loader: returning',
              JSON.stringify({ keys: Object.keys(result), baseURL: result.baseURL })
            )
            return result
          } catch (err: any) {
            logError('loader ERROR:', err?.message ?? err, err?.stack ?? '')
            throw err
          }
        },
        methods: authHandler.getMethods()
      }
    }
  }

export const KiroOAuthPlugin = createKiroPlugin(KIRO_PROVIDER_ID)

const pluginModule: PluginModule = {
  id: 'kiro-auth',
  server: KiroOAuthPlugin
}

export default pluginModule
