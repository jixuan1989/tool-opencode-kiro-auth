import type { AuthHook } from '@opencode-ai/plugin'
import type { AccountRepository } from '../../infrastructure/database/account-repository.js'
import * as logger from '../../plugin/logger.js'
import { GoogleAuthMethod } from './google-auth-method.js'

export class AuthHandler {
  private accountManager?: any

  constructor(
    private config: any,
    private repository: AccountRepository
  ) {}

  async initialize(): Promise<void> {
    const { syncFromKiroCli } = await import('../../plugin/sync/kiro-cli.js')

    logger.log('Auth init', { autoSyncKiroCli: !!this.config.auto_sync_kiro_cli })
    if (this.config.auto_sync_kiro_cli) {
      logger.log('Kiro CLI sync: start')
      await syncFromKiroCli()
      this.repository.invalidateCache()
      const accounts = await this.repository.findAll()
      if (this.accountManager) {
        for (const a of accounts) this.accountManager.addAccount(a)
      }
      logger.log('Kiro CLI sync: done', { importedAccounts: accounts.length })
    }
  }

  setAccountManager(am: any): void {
    this.accountManager = am
  }

  getMethods(): AuthHook['methods'] {
    if (!this.accountManager) {
      return []
    }

    const googleMethod = new GoogleAuthMethod(this.config, this.repository, this.accountManager)

    return [
      {
        label: 'Google Account (Kiro)',
        type: 'oauth' as const,
        authorize: (inputs?: any) => googleMethod.authorize(inputs)
      }
    ]
  }
}
