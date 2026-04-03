import type { AccountRepository } from '../../infrastructure/database/account-repository'
import type { AccountManager } from '../../plugin/accounts'
import type { KiroAuthDetails, ManagedAccount } from '../../plugin/types'
interface UsageTrackerConfig {
  usage_tracking_enabled: boolean
  usage_sync_max_retries: number
}
export declare class UsageTracker {
  private config
  private accountManager
  private repository
  constructor(
    config: UsageTrackerConfig,
    accountManager: AccountManager,
    repository: AccountRepository
  )
  syncUsage(account: ManagedAccount, auth: KiroAuthDetails): Promise<void>
  private syncWithRetry
  private sleep
}
export {}
