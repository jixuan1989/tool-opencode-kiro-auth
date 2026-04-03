import { RegionSchema } from '../../plugin/config/schema.js';
import * as logger from '../../plugin/logger.js';
import { GoogleAuthMethod } from './google-auth-method.js';
import { IdcAuthMethod } from './idc-auth-method.js';
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
        const idcMethod = new IdcAuthMethod(this.config, this.repository, this.accountManager);
        return [
            {
                label: 'Google Account (Kiro)',
                type: 'oauth',
                prompts: [
                    {
                        type: 'text',
                        key: 'region',
                        message: 'Region (leave blank for us-east-1)',
                        placeholder: 'us-east-1',
                        validate: (value) => {
                            if (!value)
                                return undefined;
                            return RegionSchema.safeParse(value.trim()).success
                                ? undefined
                                : 'Please enter a valid AWS region';
                        }
                    }
                ],
                authorize: (inputs) => googleMethod.authorize(inputs)
            },
            {
                label: 'AWS Builder ID / IAM Identity Center',
                type: 'oauth',
                prompts: [
                    {
                        type: 'text',
                        key: 'start_url',
                        message: 'IAM Identity Center Start URL (leave blank for AWS Builder ID)',
                        placeholder: 'https://your-company.awsapps.com/start',
                        validate: (value) => {
                            if (!value)
                                return undefined;
                            try {
                                new URL(value);
                                return undefined;
                            }
                            catch {
                                return 'Please enter a valid URL';
                            }
                        }
                    },
                    {
                        type: 'text',
                        key: 'idc_region',
                        message: 'IAM Identity Center region (sso_region) (leave blank for us-east-1)',
                        placeholder: 'us-east-1',
                        validate: (value) => {
                            if (!value)
                                return undefined;
                            return RegionSchema.safeParse(value.trim()).success
                                ? undefined
                                : 'Please enter a valid AWS region';
                        }
                    }
                ],
                authorize: (inputs) => idcMethod.authorize(inputs)
            }
        ];
    }
}
