import { fetchUsageLimits, updateAccountQuota } from '../../plugin/usage';
export class UsageTracker {
    config;
    accountManager;
    repository;
    constructor(config, accountManager, repository) {
        this.config = config;
        this.accountManager = accountManager;
        this.repository = repository;
    }
    async syncUsage(account, auth) {
        if (!this.config.usage_tracking_enabled) {
            return;
        }
        this.syncWithRetry(account, auth, 0).catch(() => { });
    }
    async syncWithRetry(account, auth, attempt) {
        try {
            const u = await fetchUsageLimits(auth);
            updateAccountQuota(account, u, this.accountManager);
            await this.repository.batchSave(this.accountManager.getAccounts());
        }
        catch (e) {
            if (attempt < this.config.usage_sync_max_retries) {
                await this.sleep(1000 * Math.pow(2, attempt));
                return this.syncWithRetry(account, auth, attempt + 1);
            }
            if (e.message?.includes('403') ||
                e.message?.includes('invalid') ||
                e.message?.includes('bearer token')) {
                this.accountManager.markUnhealthy(account, e.message);
                this.repository.save(account).catch(() => { });
            }
        }
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}
