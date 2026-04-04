import * as logger from '../../plugin/logger.js';
import { GoogleAuthMethod } from './google-auth-method.js';
export class AuthHandler {
    config;
    repository;
    accountManager;
    constructor(config, repository) {
        this.config = config;
        this.repository = repository;
    }
    async initialize() {
        const { syncFromKiroCli } = await import('../../plugin/sync/kiro-cli.js');
        logger.log('Auth init', { autoSyncKiroCli: !!this.config.auto_sync_kiro_cli });
        if (this.config.auto_sync_kiro_cli) {
            logger.log('Kiro CLI sync: start');
            await syncFromKiroCli();
            this.repository.invalidateCache();
            const accounts = await this.repository.findAll();
            if (this.accountManager) {
                for (const a of accounts)
                    this.accountManager.addAccount(a);
            }
            logger.log('Kiro CLI sync: done', { importedAccounts: accounts.length });
        }
    }
    setAccountManager(am) {
        this.accountManager = am;
    }
    getMethods() {
        if (!this.accountManager) {
            return [];
        }
        const googleMethod = new GoogleAuthMethod(this.config, this.repository, this.accountManager);
        return [
            {
                label: 'Google Account (Kiro)',
                type: 'oauth',
                authorize: (inputs) => googleMethod.authorize(inputs)
            }
        ];
    }
}
